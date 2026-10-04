import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthReplayService } from '../../core/services/auth-replay.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../shared/ui/loading/loading-indicator';
import { ProfileForm } from './profile-form/profile-form';
import { ProfileTickets, TicketsTab } from './tickets/profile-tickets';
import { TicketsService } from './tickets/tickets.service';

/** The two top-level sections of the Profile page, per the supplied design. */
export type ProfileSection = 'info' | 'tickets';

/** URL value of the `tab` query parameter for each section. */
const SECTION_TAB_PARAM: Record<ProfileSection, string> = {
  info: 'personal-info',
  tickets: 'tickets',
};

/** `?tab=` values (including the legacy `upcoming` alias) mapped to a section. */
const SECTION_BY_TAB_PARAM: Record<string, ProfileSection> = {
  'personal-info': 'info',
  info: 'info',
  tickets: 'tickets',
  upcoming: 'tickets',
};

/**
 * The Personal Information page, and the gate in front of it.
 *
 * The page renders nothing but the authenticated visitor's own profile: the
 * values come from the user state `/me` and login already filled, never from a
 * duplicate request, and a save writes the server's returned user back into that
 * same state — so the navbar indicator, the completion banner and the booking
 * gate all follow without a refresh.
 *
 * A guest never sees profile content. They are sent through the application's
 * single sign-in recovery flow (`AuthReplayService`) — the same one a protected
 * 401 uses — so there is no second login mechanism on this page; dismissing it
 * leaves a sign-in prompt rather than profile data.
 */
/**
 * The section a `?tab=` value names, defaulting to Personal Information for an
 * absent or unrecognised value so a hand-edited URL still lands somewhere valid.
 */
function sectionFromTab(tab: string | null): ProfileSection {
  if (tab === null) {
    return 'info';
  }

  return SECTION_BY_TAB_PARAM[tab] ?? 'info';
}

@Component({
  imports: [ErrorState, LoadingIndicator, ProfileForm, ProfileTickets],
  providers: [TicketsService],
  selector: 'app-profile-page',
  styleUrl: './profile-page.scss',
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);
  private readonly ticketsService = inject(TicketsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * The section the URL asks for (`?tab=personal-info` / `?tab=tickets`).
   *
   * Read from the router, not stored: the navbar dropdown, the order
   * confirmation's "My Tickets" button and a pasted URL all arrive the same way,
   * so there is one source of truth and changing tabs never needs a reload.
   * An unknown or absent value falls back to Personal Information.
   */
  private readonly requestedSection = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tab'))),
    { initialValue: null },
  );

  /**
   * Which top-level section is visible.
   *
   * Personal Information first, per the first supplied screenshot; My Tickets
   * second, per the ticket screenshots. Both children stay mounted and are only
   * hidden, so switching sections never destroys the profile form state and the
   * ticket list keeps its loaded response.
   *
   * A `linkedSignal` over the query parameter: the URL sets the section, and a
   * local tab click overrides it until the router reports something new.
   */
  protected readonly activeSection = linkedSignal<ProfileSection, ProfileSection>({
    source: () => sectionFromTab(this.requestedSection()),
    computation: (section) => section,
  });

  /** Which Upcoming/Past list the tickets section shows. Owned by the page. */
  protected readonly ticketsTab = signal<TicketsTab>('upcoming');

  /** Upcoming ticket count for the My Tickets badge, from the shared service. */
  protected readonly upcomingCount = this.ticketsService.upcomingCount;

  /** Whether the sign-in recovery flow was dismissed without signing in. */
  private readonly loginDismissed = signal(false);

  /** Whether this page is already waiting behind the single recovery flow. */
  private loginRequested = false;

  /**
   * A failed `GET /me` restore, or `null` while there is no such failure to
   * report. A plain guest has no failure — `error` stays `null` until a restore
   * was actually attempted — so the two states stay distinguishable.
   */
  protected readonly sessionError = computed(() =>
    this.auth.isAuthenticated() || this.auth.initializing() ? null : this.auth.error(),
  );

  /** The failure's own words when the server sent any, neutral fallback otherwise. */
  protected readonly sessionErrorMessage = computed(
    () =>
      this.sessionError()?.body?.message ?? 'Your profile could not be loaded. Please try again.',
  );

  constructor() {
    // The gate re-evaluates whenever the session does: while a stored token is
    // still being exchanged the page waits rather than opening the wrong flow,
    // and a signed-in visitor never triggers a login dialog at all.
    effect(() => {
      if (
        this.auth.isAuthenticated() ||
        this.auth.initializing() ||
        this.sessionError() !== null ||
        this.loginDismissed()
      ) {
        return;
      }

      this.requestLogin();
    });

    // A freshly purchased ticket must be there the moment My Tickets opens, so
    // opening the section re-reads `GET /tickets`. The collection read is
    // untracked: only the section may trigger a refresh, otherwise each response
    // would schedule the next one.
    effect(() => {
      if (this.activeSection() !== 'tickets') {
        return;
      }

      if (untracked(() => this.ticketsService.tickets()) === null) {
        return;
      }

      void this.ticketsService.reload();
    });
  }

  /** Retries the session restore the page failed to read; nothing is re-fetched here. */
  protected retrySession(): void {
    void this.auth.restoreSession();
  }

  /**
   * Shows one top-level section; the other stays mounted but hidden.
   *
   * The query parameter is the source of truth, so the click writes it rather
   * than only moving local state — the URL then always describes what is on
   * screen, and a refresh or a shared link lands on the same section.
   */
  protected selectSection(section: ProfileSection): void {
    this.activeSection.set(section);

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: SECTION_TAB_PARAM[section] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Joins the application's single sign-in recovery flow.
   *
   * A successful login completes it — the effect above then sees an
   * authenticated visitor and the page renders — while a dismissal rejects the
   * shared observable and leaves this page on its sign-in prompt.
   */
  protected requestLogin(): void {
    if (this.loginRequested) {
      return;
    }

    this.loginRequested = true;

    this.replay.waitForLogin().subscribe({
      next: () => {
        this.loginRequested = false;
      },
      error: () => {
        this.loginRequested = false;
        this.loginDismissed.set(true);
      },
    });
  }
}

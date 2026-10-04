import { Component, computed, effect, inject, signal } from '@angular/core';
import { AuthReplayService } from '../../core/services/auth-replay.service';
import { AuthService } from '../../core/services/auth.service';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../shared/ui/loading/loading-indicator';
import { ProfileForm } from './profile-form/profile-form';
import { ProfileTickets } from './tickets/profile-tickets';

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
@Component({
  imports: [ErrorState, LoadingIndicator, ProfileForm, ProfileTickets],
  selector: 'app-profile-page',
  styleUrl: './profile-page.scss',
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);

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
  }

  /** Retries the session restore the page failed to read; nothing is re-fetched here. */
  protected retrySession(): void {
    void this.auth.restoreSession();
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

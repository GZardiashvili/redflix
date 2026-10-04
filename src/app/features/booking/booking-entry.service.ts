import { Service, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MovieSession } from '../../core/models/session';
import { AuthReplayService } from '../../core/services/auth-replay.service';
import { AuthService } from '../../core/services/auth.service';
import { BookingContext, BookingMovie } from './booking-context';
import { BookingStateService } from './booking-state.service';

/**
 * Entry point into booking, and the gate in front of it.
 *
 * A screening can only be booked by an authenticated account with a complete
 * profile, so {@link select} does three things in order:
 *
 * 1. Records the screening as a {@link BookingContext}. This happens first and
 *    unconditionally, so the visitor's intent survives everything that follows.
 * 2. Sends a guest through the existing login flow (`AuthReplayService`), the
 *    same one a protected 401 uses. The recorded context is still there when the
 *    login completes, so booking resumes on its own — no second click.
 * 3. Applies the profile gate: an authenticated account whose
 *    `profileComplete` is `false` is not sent into seat selection. Its screening
 *    is kept and the visitor is routed to `/profile`, the existing profile seam.
 *
 * If the profile later becomes complete, {@link openPending} re-evaluates the
 * same gate, so a booking that was parked at the profile step can continue once
 * the profile feature exists, without this service knowing anything about it.
 *
 * Nothing here calls the booking API: no seats, no holds, no orders.
 */
@Service()
export class BookingEntryService {
  private readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);
  private readonly bookingState = inject(BookingStateService);
  private readonly router = inject(Router);

  private readonly pendingState = signal<BookingContext | null>(null);

  /**
   * The screening waiting on a gate, or `null`. Once booking opens, the context
   * moves into {@link BookingStateService} and this is `null` again, so exactly
   * one owner holds the screening at any moment.
   */
  readonly pending = this.pendingState.asReadonly();

  /**
   * Whether an authenticated account is being held back by an incomplete
   * profile. The page uses this to explain why booking did not start.
   */
  readonly blockedByProfile = computed(
    () => this.pendingState() !== null && this.auth.isAuthenticated() && !this.profileComplete(),
  );

  /**
   * The screening parked at the profile gate is routed to `/profile` only once.
   * The login flag does the same for the login gate: the effect re-runs on every
   * auth change, and the shared modal must be requested once per parked
   * screening rather than once per re-run.
   */
  private profileRequestedFor: number | null = null;
  private loginRequestedFor: number | null = null;

  constructor() {
    // The gates are re-evaluated whenever either the parked screening or the
    // auth state changes, which is what lets a completed login resume booking
    // on its own and a still-initializing session simply wait instead of being
    // mistaken for a guest.
    effect(() => {
      this.advance();
    });
  }

  /**
   * Records the picked screening and runs it through the authorization gates.
   *
   * Sold-out and age-blocked tiles never reach this method; the caller keeps
   * those guards.
   */
  select(session: MovieSession, movie: BookingMovie): void {
    this.pendingState.set({
      sessionId: session.id,
      startsAt: session.startsAt,
      date: session.date,
      time: session.time,
      price: session.price,
      venueName: session.venue.name,
      hallName: session.hall.name,
      movieSlug: movie.slug,
      movieTitle: movie.title,
      ageRatingMinAge: movie.ageRating.minAge,
      formatName: session.format.name,
      languageName: session.language.name,
      languageCode: session.language.code,
    });

    this.profileRequestedFor = null;
    this.loginRequestedFor = null;
  }

  /**
   * Continues a parked booking if the gates now allow it.
   *
   * Exposed for the profile flow: once a profile feature completes a profile and
   * the account is refreshed, calling this resumes the booking the visitor had
   * already chosen, without a second click on the screening.
   */
  openPending(): void {
    this.advance();
  }

  /**
   * Drops any parked screening and its one-shot gate flags.
   *
   * Called when the booking dialog closes, however it closed. Without it a
   * screening parked at the login or profile gate would outlive the visit: the
   * next time auth state changed for any reason — a login from the header, a
   * token refresh — the effect above would fire and open the booking dialog for
   * a screening the visitor had already walked away from.
   *
   * Harmless when nothing is parked, which is the common case: the screening has
   * already moved into {@link BookingStateService} and is cleared by that state.
   */
  reset(): void {
    this.pendingState.set(null);
    this.profileRequestedFor = null;
    this.loginRequestedFor = null;
  }

  /** Applies the auth and profile gates to the parked screening, if any. */
  private advance(): void {
    const pending = this.pendingState();

    if (pending === null) {
      return;
    }

    // Auth is still exchanging a stored token for a user: wait rather than
    // treating the visitor as a guest and opening the wrong flow.
    if (this.auth.initializing()) {
      return;
    }

    if (!this.auth.isAuthenticated()) {
      this.requestLogin(pending);
      return;
    }

    if (!this.profileComplete()) {
      this.requestProfile(pending);
      return;
    }

    // Ownership of the screening moves to the flow state.
    this.pendingState.set(null);
    this.bookingState.startBooking(pending);
  }

  /**
   * Opens the shared login modal and waits for it to succeed.
   *
   * `waitForLogin()` completes on a successful login, which makes the effect
   * above run again and continue the booking; a dismissal rejects, which must
   * not throw here. A dismissal is also a decision to abandon: the screening is
   * dropped, so it cannot resurface on some later, unrelated auth change. The
   * visitor who still wants it simply clicks the screening again.
   */
  private requestLogin(pending: BookingContext): void {
    if (this.loginRequestedFor === pending.sessionId) {
      return;
    }

    this.loginRequestedFor = pending.sessionId;
    this.replay.waitForLogin().subscribe({
      next: () => undefined,
      error: () => this.reset(),
    });
  }

  /**
   * Routes the visitor to the existing profile page, keeping the screening.
   *
   * Navigation happens once per parked screening: the effect re-runs whenever
   * the account changes, and the visitor must not be pushed to `/profile` again
   * on each of those.
   */
  private requestProfile(pending: BookingContext): void {
    if (this.profileRequestedFor === pending.sessionId) {
      return;
    }

    this.profileRequestedFor = pending.sessionId;
    void this.router.navigate(['/profile']);
  }

  private profileComplete(): boolean {
    return this.auth.user()?.profileComplete === true;
  }
}

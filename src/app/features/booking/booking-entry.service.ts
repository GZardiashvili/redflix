import { Service, inject, signal } from '@angular/core';
import { MovieSession } from '../../core/models/session';
import { AuthReplayService } from '../../core/services/auth-replay.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * The screening the visitor has chosen to book.
 *
 * The booking flow itself is a later task, so this holds no booking state: it is
 * the hand-off point between "a screening was picked" and "the booking screen
 * opens for it". The id and the fields the booking screen needs to render its
 * heading are kept; nothing is fetched, held or invented here.
 */
export interface BookingSelection {
  sessionId: number;
  startsAt: string;
  date: string;
  time: string;
  price: number;
  venueName: string;
  hallName: string;
  movieSlug: string;
}

/**
 * Entry point into booking.
 *
 * Selection is a two-step concern, because a guest may pick a screening before
 * they have an account. {@link select} records the choice immediately — so the
 * intended screening survives the login round-trip — and, when the visitor is a
 * guest, joins the existing authorization flow that opens the login modal. A
 * successful login completes that flow and the recorded selection is then ready
 * for the booking screen to pick up. Dismissing the modal simply cancels it: the
 * selection stays recorded but nothing navigates on its own.
 */
@Service()
export class BookingEntryService {
  private readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);

  private readonly selectionState = signal<BookingSelection | null>(null);

  /** The screening awaiting booking, or `null` when none has been chosen. */
  readonly selection = this.selectionState.asReadonly();

  /**
   * Records the picked screening and, for a guest, starts the login flow that
   * must succeed before booking can continue.
   */
  select(session: MovieSession, movieSlug: string): void {
    this.selectionState.set({
      sessionId: session.id,
      startsAt: session.startsAt,
      date: session.date,
      time: session.time,
      price: session.price,
      venueName: session.venue.name,
      hallName: session.hall.name,
      movieSlug,
    });

    if (!this.auth.isAuthenticated()) {
      // `waitForLogin()` opens the shared login modal and completes on a
      // successful login; a dismissal rejects, which must not throw here.
      this.replay.waitForLogin().subscribe({ error: () => undefined });
    }
  }

  /** Clears the recorded screening once booking has consumed or abandoned it. */
  clear(): void {
    this.selectionState.set(null);
  }
}

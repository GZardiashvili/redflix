import { Service, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { SessionSeatMap } from '../../core/models/seat';
import { MoviesService } from '../../core/services/movies.service';
import { BookingStateService } from './booking-state.service';

/**
 * The seat map of the screening currently being booked.
 *
 * This is the single owner of the seat-map response: the Step 1 components read
 * from it and nothing else keeps a copy. It follows the booking state rather
 * than accepting a session id from a component, so the map can never describe a
 * different screening than the header above it.
 *
 * Two properties matter for correctness:
 *
 * * **Session identity.** The map is requested for
 *   {@link BookingStateService}'s current session id, and the request is redone
 *   whenever that changes. Closing the booking clears the map, so a later booking
 *   of another screening can never show the previous hall's seats.
 * * **No stale writes.** Requests are switched, so a slow response for a session
 *   the visitor has already moved away from is discarded instead of landing on
 *   screen, and the in-flight request is cancelled with it.
 *
 * Nothing here mutates anything: no holds, no orders, no selection.
 */
@Service()
export class SeatMapService {
  private readonly movies = inject(MoviesService);
  private readonly booking = inject(BookingStateService);

  private readonly mapState = signal<SessionSeatMap | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly attemptState = signal(0);

  /** The seat map of the current booking session, or `null` while none is loaded. */
  readonly map = this.mapState.asReadonly();

  /** Whether the seat-map request is in flight. */
  readonly loading = this.loadingState.asReadonly();

  /** Failure message for the current request, `null` otherwise. */
  readonly error = this.errorState.asReadonly();

  /**
   * Whether a request has settled without producing a layout. The API always
   * sends at least one section for a real hall, so this guards a malformed
   * response instead of rendering an empty room as a deliberate "no seats".
   */
  readonly isEmpty = computed(
    () => this.mapState() !== null && this.mapState()!.sections.length === 0,
  );

  constructor() {
    // The seat map is a function of the booking session, so it is requested
    // whenever that session changes — including becoming `null`, which clears it.
    // `attempt` is part of the same key so a retry re-enters the same `switchMap`.
    toObservable(computed(() => this.request()))
      .pipe(
        switchMap(({ sessionId }) => {
          this.reset();

          return sessionId === null ? EMPTY : this.fetch(sessionId);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Re-requests the current session's map after a failure. */
  retry(): void {
    this.attemptState.update((attempt) => attempt + 1);
  }

  /**
   * The current request key: the booking session plus the retry counter, so a new
   * session and a retry are both a change of key that cancels what came before.
   */
  private request(): { sessionId: number | null; attempt: number } {
    return {
      sessionId: this.booking.context()?.sessionId ?? null,
      attempt: this.attemptState(),
    };
  }

  /** Clears the map and its state, so nothing of a previous hall survives. */
  private reset(): void {
    this.mapState.set(null);
    this.errorState.set(null);
    this.loadingState.set(false);
  }

  /** Loads one session's map, or reports the failure for retry. */
  private fetch(sessionId: number) {
    this.loadingState.set(true);

    return this.movies.getSessionSeats(sessionId).pipe(
      tap((response) => {
        this.mapState.set(response.data);
        this.loadingState.set(false);
      }),
      catchError((error: unknown) => {
        this.mapState.set(null);
        this.errorState.set(
          toApiError(error).body?.message ?? 'Could not load the seat map. Please try again.',
        );
        this.loadingState.set(false);

        // Swallowed because it is rendered in place: the booking dialog above it
        // stays open, and Retry re-requests this same session id.
        return EMPTY;
      }),
    );
  }
}

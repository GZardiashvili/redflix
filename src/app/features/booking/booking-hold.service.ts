import { Service, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { Hold, HoldRequestSeat } from '../../core/models/hold';
import { HoldsService } from '../../core/services/holds.service';
import { BookingStateService } from './booking-state.service';
import { SeatMapService } from './seat-map.service';
import { SeatSelectionService } from './seat-selection.service';

/** Why a hold request did not produce a hold. */
export type HoldFailureKind = 'conflict' | 'rejected' | 'error';

/**
 * A failed hold request, reduced to what the visitor is shown.
 *
 * One value rather than several parallel signals, so the inline banner and the
 * announcement to assistive technology cannot disagree: both read the same
 * object.
 */
export interface HoldFailure {
  readonly kind: HoldFailureKind;
  /** The API's own `message`, shown verbatim; never replaced by frontend copy. */
  readonly message: string;
  /**
   * Seat codes the server could not give us, for `409`.
   *
   * Empty for every other kind: a rule violation or a transport failure is not
   * about particular seats, and naming seats that are still fine would be a lie.
   */
  readonly contested: readonly string[];
}

/** Shown when the countdown reaches zero; the API defines this wording. */
const EXPIRED_MESSAGE = 'Your hold time expired. Please re-select your seats.';

/**
 * The booking hold: the seats the server has reserved, how long they are
 * reserved for, and every way that reservation can end.
 *
 * This is the single owner of hold state. The step components read
 * {@link submitting}, {@link failure} and {@link formattedRemaining} from it and
 * ask it to act; nothing else stores a `holdId` or counts down seconds.
 *
 * **The countdown is derived from the server's clock, never accumulated
 * locally.** {@link secondsRemaining} compares the hold's `expiresAt` — an
 * absolute point in time — against `Date.now()` on every tick. The one-second
 * interval therefore decides only *how often* the value is redrawn, never how
 * much it decreases: if the tab is throttled, backgrounded, or the machine
 * sleeps, the next tick computes from the same `expiresAt` and lands on the
 * correct remaining time. A local decrement would drift by exactly the missed
 * ticks and could show time remaining after the server had already freed the
 * seats.
 *
 * `expiresAt` is preferred over the response's `secondsRemaining` for the same
 * reason: that number is a snapshot taken when the response was written and is
 * already stale by the time it is rendered. It is used only as a fallback if
 * `expiresAt` cannot be parsed.
 *
 * **Every exit follows the server's decision, not the client's.** The hold is
 * released explicitly in exactly one place — {@link release}, when the visitor
 * closes the booking. Going back from Step 2 to Step 1 deliberately does *not*
 * release: that hold is still wanted, and the API replaces it when the next
 * submission arrives, so no `DELETE` is needed first. On expiry the server has
 * already released the hold, so the client only stops treating the seats as
 * reserved. Once the order is paid for, {@link complete} drops it instead — the
 * seats are sold, so there is nothing left to free.
 *
 * The teardown itself lives in {@link expire} and {@link reconcileConflict},
 * which checkout reuses when `POST /orders` ends the hold instead of the clock
 * doing so. That is the point of keeping them here: one hold, one way to lose
 * it, whichever request discovers the loss.
 */
@Service()
export class BookingHoldService {
  private readonly holds = inject(HoldsService);
  private readonly booking = inject(BookingStateService);
  private readonly selection = inject(SeatSelectionService);
  private readonly seatMap = inject(SeatMapService);

  private readonly holdState = signal<Hold | null>(null);
  private readonly submittingState = signal(false);
  private readonly failureState = signal<HoldFailure | null>(null);

  /**
   * The current wall-clock reading, refreshed once a second while a hold is
   * live. It is the only thing that moves; the remaining time is derived from
   * it, so no interval ever decrements a stored counter.
   */
  private readonly nowState = signal(Date.now());

  /** The live hold, or `null` when no seats are currently reserved. */
  readonly hold = this.holdState.asReadonly();

  /** Whether a hold request is in flight; the Step 1 control waits meanwhile. */
  readonly submitting = this.submittingState.asReadonly();

  /** Why the last hold request failed, or `null` when there is nothing to report. */
  readonly failure = this.failureState.asReadonly();

  /** Whether a hold currently exists. */
  readonly hasHold = computed(() => this.holdState() !== null);

  /** Whether the current selection can be sent for a hold right now. */
  readonly canSubmit = computed(() => this.selection.canContinue() && !this.submittingState());

  /**
   * Seconds left on the hold, or `null` when there is no hold.
   *
   * Recomputed from `expiresAt` against {@link nowState} on every tick, so it
   * self-corrects after throttling instead of drifting. Clamped at zero: a hold
   * that has just expired reads `00:00` for the moment between the expiry tick
   * and the follow-up that tears the flow down.
   */
  readonly secondsRemaining = computed(() => {
    const hold = this.holdState();

    if (hold === null) {
      return null;
    }

    const expiresAt = Date.parse(hold.expiresAt);

    // A malformed `expiresAt` must not put `NaN` in the header; the response's
    // own snapshot is then the only thing left to show.
    if (Number.isNaN(expiresAt)) {
      return Math.max(0, hold.secondsRemaining);
    }

    return Math.max(0, Math.ceil((expiresAt - this.nowState()) / 1000));
  });

  /** The countdown as `MM:SS`, or `null` when there is no hold. */
  readonly formattedRemaining = computed(() => {
    const remaining = this.secondsRemaining();

    return remaining === null ? null : formatDuration(remaining);
  });

  /**
   * Whether the hold is close enough to expiry to be worth warning about.
   *
   * The design turns the timer red for the last minute, so that is the rule:
   * strictly under 60 seconds left. Derived from the same value as the digits
   * themselves, so the colour can never disagree with the number.
   */
  readonly isUrgent = computed(() => {
    const remaining = this.secondsRemaining();

    return remaining !== null && remaining < 60;
  });

  constructor() {
    // One ticking signal while a hold is live, none while there is nothing to
    // count down. The key is the hold's identity alone, so no unrelated signal
    // can restart the interval.
    toObservable(this.hold)
      .pipe(
        switchMap((hold) => {
          if (hold === null) {
            return EMPTY;
          }

          // Seed the clock immediately, so the first rendered value is correct
          // rather than one tick late.
          this.nowState.set(Date.now());

          return timer(1000, 1000);
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.nowState.set(Date.now()));

    // Expiry is a consequence of the derived countdown reaching zero, so it is
    // observed rather than computed: handling it changes other services and asks
    // the API for the map again, which is what an effect is for.
    effect(() => {
      if (this.holdState() !== null && this.secondsRemaining() === 0) {
        this.expire();
      }
    });

    // A hold belongs to one booking session. Closing the flow drops it locally —
    // the dialog's own close path releases it over the API first — so a timer can
    // never keep running against a screening the visitor has left behind.
    effect(() => {
      if (this.booking.context() === null && this.holdState() !== null) {
        this.discard();
      }
    });
  }

  /**
   * Requests a hold for the current selection and, on success, moves to Step 2.
   *
   * This is the whole of the Step 1 → Step 2 transition: the summary's control
   * reports its own state from {@link submitting} and calls this. Nothing
   * advances before the server has answered with a `holdId`.
   *
   * The payload is built from {@link SeatSelectionService}, mapping each stored
   * ticket type **id** to the **slug** the endpoint requires. The two
   * vocabularies differ deliberately — the configuration numbers its ticket
   * types, the booking API names them — so the translation happens here, once.
   */
  submit(): void {
    const context = this.booking.context();

    if (context === null || this.submittingState()) {
      return;
    }

    // A seat whose ticket type has disappeared since it was picked cannot be
    // sent, because the request would carry no slug at all. `canSubmit` already
    // refuses to let such a selection reach the control; this is the same rule
    // enforced at the request boundary.
    const seats: HoldRequestSeat[] = [];
    const lines = this.selection.lines();

    for (const line of lines) {
      const ticketType = line.ticketType?.slug;

      if (ticketType === undefined) {
        this.failureState.set({
          kind: 'error',
          message: 'Those seats are no longer available. Please review your selection.',
          contested: [],
        });
        return;
      }

      seats.push({ seatId: line.seatId, ticketType });
    }

    if (seats.length === 0) {
      return;
    }

    this.submittingState.set(true);
    this.failureState.set(null);

    this.holds
      .createHold(context.sessionId, seats)
      .pipe(
        switchMap((response) => {
          this.holdState.set(response.data);
          this.booking.showStep2();

          return EMPTY;
        }),
        catchError((error: unknown) => {
          this.handleFailure(error);

          return EMPTY;
        }),
      )
      .subscribe({ complete: () => this.submittingState.set(false) });
  }
  /**
   * Releases the hold in the background and forgets it locally.
   *
   * Called when the visitor closes the booking dialog, however they closed it.
   * The UI is not held up waiting: the seats are freed so another visitor can
   * take them, but the dialog closes immediately either way. A release that
   * fails — most often a `404` because the hold already timed out server-side —
   * leaves nothing to recover, so the failure is swallowed rather than shown to
   * someone who is already back on the page underneath.
   *
   * Not called when moving back from Step 2 to Step 1: that hold is still
   * wanted, and a new submission replaces it server-side on its own.
   */
  release(): void {
    const hold = this.holdState();

    this.discard();

    if (hold === null) {
      return;
    }

    this.holds
      .releaseHold(hold.holdId)
      .pipe(catchError(() => EMPTY))
      .subscribe({ complete: () => undefined, error: () => undefined });
  }

  /** Drops any outstanding failure notice, e.g. when the visitor picks again. */
  clearFailure(): void {
    this.failureState.set(null);
  }

  /** Forgets the hold without contacting the API; see {@link release}. */
  private discard(): void {
    this.holdState.set(null);
    this.failureState.set(null);
    this.submittingState.set(false);
  }

  /**
   * Turns a failed hold request into the one thing the visitor is told.
   *
   * `409` is the interesting case. The API answers with the seat codes it could
   * not give us, so the reconciliation is:
   *
   * 1. those seats leave the selection, and only those — a seat the visitor did
   *    win is still theirs;
   * 2. the seat map is refetched, because the server's view of the hall has
   *    moved on from the one on screen and only the server knows which seats
   *    went with them;
   * 3. the visitor stays on Step 1, since there is no hold to enter Step 2 with.
   *
   * No hold exists on this path, so nothing is released — there is nothing to
   * release.
   *
   * `422` means a booking rule blocked the request — the session had already
   * started, for example — and carries only a message, so it is shown as it
   * came. Anything else keeps the same shape with no seats named, because nothing
   * says which seats were at fault.
   */
  private handleFailure(error: unknown): void {
    const failure = toApiError(error);

    if (failure.status === 409) {
      this.reconcileConflict(
        parseContested(failure),
        failure.body?.message ?? 'Some of those seats were just taken. Please pick again.',
      );

      return;
    }

    this.failureState.set({
      kind: failure.status === 422 ? 'rejected' : 'error',
      message: describeFailure(failure),
      contested: [],
    });
  }

  /**
   * Reconciles a `409` from any booking request: the seats named as
   * `contested` leave the selection, the rest stay, the map is refetched, and
   * the flow returns to Step 1 with the API's own sentence.
   *
   * Returned to Step 1 rather than left where it was: during checkout the visitor
   * is on Step 2, and there is nothing left to pay for, so Step 1 is the only step
   * that means anything. During hold creation they are already there, making this
   * a no-op rather than a second behaviour.
   *
   * One implementation for both places a conflict can arrive — creating the hold
   * and paying for it — because the reconciliation is the same fact about the
   * server's seat map either way. Duplicating it would let the two paths drift
   * into disagreeing about which seats are still ours.
   */
  reconcileConflict(contested: readonly string[], message: string): void {
    this.selection.removeByCodes(contested);
    this.seatMap.refresh();
    this.failureState.set({ kind: 'conflict', message, contested: [...contested] });

    // The order could not be paid for, so there is nothing to check out: the
    // visitor goes back to the seats and picks again from the refreshed map.
    this.booking.showStep1();
  }

  /**
   * Ends the hold because the server has stopped honouring it.
   *
   * Called by the countdown when it reaches `expiresAt`, and by checkout when
   * `POST /orders` refuses the order for a rule reason. The second case is the
   * same outcome arrived at later: the seats are no longer reserved, so the
   * selection is cleared, the map refetched and the flow returned to Step 1 with
   * the API's own wording for why.
   *
   * `message` is passed rather than assumed so the visitor is told what the
   * server actually said; the countdown supplies {@link EXPIRED_MESSAGE} because
   * by then the server has stopped answering.
   */
  expire(message: string = EXPIRED_MESSAGE): void {
    this.holdState.set(null);
    this.selection.clear();
    this.seatMap.refresh();
    this.failureState.set({ kind: 'error', message, contested: [] });

    // Step 2 has no meaning without a hold, so the flow falls back to Step 1
    // whether or not the dialog is the thing currently on screen.
    this.booking.showStep1();
  }

  /**
   * Consumes the hold, because the order it was holding has now been paid for.
   *
   * Deliberately **not** a release: the seats are sold, so there is nothing left
   * to free and no `DELETE` is sent — the hold id no longer names a hold. Only
   * the local state is dropped, which also stops the countdown that would
   * otherwise report an expiry for a booking that succeeded.
   */
  complete(): void {
    this.holdState.set(null);
  }
}

/**
 * Extracts the seat codes from a `409` body.
 *
 * The documented shape is `contested: ["E7", "E8"]`, but the field is typed
 * `unknown` in the shared error model because its shape was unspecified when
 * that was written. Only real strings are taken, so a shape change degrades to
 * "no seats named" — the API's message is still shown — rather than to seat codes
 * that cannot be matched against the map.
 */
function parseContested(failure: ApiError): string[] {
  const contested = failure.body?.contested;

  if (!Array.isArray(contested)) {
    return [];
  }

  return contested.filter((code): code is string => typeof code === 'string');
}

/**
 * The message for a failure that is not a seat conflict.
 *
 * A `422` with no `errors` is a booking rule violation and the `message` is the
 * whole story, so it is shown as the API wrote it. Server messages are never
 * replaced with frontend copy; the fallback only covers a response that carried
 * no usable message at all.
 */
function describeFailure(failure: ApiError): string {
  return failure.body?.message ?? 'Could not hold those seats. Please try again.';
}

/** Formats whole seconds as `MM:SS`; minutes are not wrapped. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

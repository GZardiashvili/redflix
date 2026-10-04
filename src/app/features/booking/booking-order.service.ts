import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../../core/api/api-error';
import { Order, OrderRequest } from '../../core/models/order';
import { OrdersService } from '../../core/services/orders.service';
import { BookingHoldService } from './booking-hold.service';
import { BookingEntryService } from './booking-entry.service';
import { BookingStateService } from './booking-state.service';
import { SeatSelectionService } from './seat-selection.service';

/** Why a submitted order did not produce an order. */
export type OrderFailureKind = 'fields' | 'blocked' | 'conflict' | 'error';

/**
 * A failed order request, reduced to what the checkout form acts on.
 *
 * The `kind` is the decision the form has to make, not a status code: `fields`
 * means the messages belong on specific inputs and the visitor stays in Step 2,
 * while `blocked`, `conflict` and `error` all mean the hold is gone and the
 * visitor is on their way back to Step 1 with the hold service's banner.
 */
export interface OrderFailure {
  readonly kind: OrderFailureKind;
  /** The API's own `message`, shown verbatim. */
  readonly message: string;
  /**
   * Per-field messages from a `422`, keyed by the API's own field names, which
   * are the form's control names. Empty for every other kind.
   */
  readonly fields: Readonly<Record<string, readonly string[]>>;
  /** Seat codes the server could not sell, for `409`; empty otherwise. */
  readonly contested: readonly string[];
}
/**
 * The order being paid for, and the outcome of paying for it.
 *
 * The booking feature's single owner of order state. It holds the request in
 * flight, so the submit control can be disabled while one is running, and the
 * order that came back, so the application knows the booking succeeded without
 * the checkout form — which is destroyed the moment the dialog closes — having to
 * carry it.
 *
 * **It owns submission, not reconciliation.** When the server refuses an order
 * because the hold died or the seats went, the teardown belongs to
 * {@link BookingHoldService} and the selection: this service recognises which of
 * those happened and hands the decision over, rather than clearing seats or
 * returning to Step 1 a second way.
 */
@Service()
export class BookingOrderService {
  private readonly orders = inject(OrdersService);
  private readonly hold = inject(BookingHoldService);
  private readonly entry = inject(BookingEntryService);
  private readonly booking = inject(BookingStateService);
  private readonly selection = inject(SeatSelectionService);

  private readonly orderState = signal<Order | null>(null);
  private readonly submittingState = signal(false);
  private readonly failureState = signal<OrderFailure | null>(null);

  /**
   * The order that was successfully paid for, or `null` when none has been.
   *
   * Survives the dialog closing: this is the record that the booking happened,
   * and the confirmation step reads it from here.
   */
  readonly order = this.orderState.asReadonly();

  /** Whether an order request is in flight. */
  readonly submitting = this.submittingState.asReadonly();

  /**
   * Whether an order may be submitted right now.
   *
   * Requires a hold, because the order is paid for the hold and nothing else —
   * there is no such thing as an order without one. Narrowed by
   * {@link submitting}, so the control cannot be pressed twice and one hold
   * cannot be turned into two orders.
   */
  readonly canSubmit = computed(() => this.hold.hasHold() && !this.submittingState());

  /** The last failure, or `null` when the last attempt has not failed. */
  readonly failure = this.failureState.asReadonly();

  /**
   * Pays for the active hold with the given buyer and card details.
   *
   * Resolves with the created order on success. Every failure is recorded in
   * {@link failure} and re-thrown as a normalised {@link ApiError} so the form
   * can react without re-inspecting the HTTP response.
   *
   * On success the hold is consumed and the booking closed here rather than by
   * the form, so no caller can end up with a paid order still on screen. The
   * entry service is reset alongside it, so no screening stays parked once the
   * order is through.
   */
  async submit(request: OrderRequest): Promise<Order> {
    if (!this.canSubmit()) {
      throw toApiError(new Error('An order cannot be submitted without an active hold.'));
    }

    this.submittingState.set(true);
    this.failureState.set(null);

    try {
      const response = await firstValueFrom(this.orders.createOrder(request));

      this.orderState.set(response.data);
      this.hold.complete();
      this.selection.clear();
      this.booking.close();
      this.entry.reset();

      return response.data;
    } catch (error) {
      throw this.handleFailure(error);
    } finally {
      this.submittingState.set(false);
    }
  }

  /**
   * Dismisses the confirmation view, dropping the order it was showing.
   *
   * Every way out of the confirmation — the Close button, the shell's own close
   * control, Escape, a click on the overlay, and "My Tickets" before it
   * navigates — arrives here, so exactly one place decides when the view is
   * gone. Dropping the reference only stops the dialog from showing again: the
   * order itself is a server record and nothing about it is changed or requested
   * here. By the time this runs there is no hold, no selection and no countdown
   * left to clear — {@link submit} took care of all three on the way in.
   */
  dismiss(): void {
    this.orderState.set(null);
  }

  /**
   * Routes a failed order to the layer that can resolve it.
   *
   * A `422` **without** `errors` and a `409` both mean the hold no longer
   * stands, so they are handed to the hold service — the same calls its own
   * expiry and conflict paths make — and the flow is already back on Step 1 by
   * the time this returns. Only a `422` with `errors`, or a transport failure,
   * leaves the visitor where they are.
   */
  private handleFailure(error: unknown): ApiError {
    const failure = toApiError(error);
    const fields = failure.body?.errors ?? {};
    const contested = parseContested(failure);

    if (failure.status === 409) {
      this.hold.reconcileConflict(
        contested,
        failure.body?.message ?? 'Some of those seats were just taken. Please pick again.',
      );
      this.failureState.set({ kind: 'conflict', message: describe(failure), fields, contested });

      return failure;
    }

    if (failure.status === 422) {
      // A `422` with no `errors` is a rule blocking the order rather than a
      // field the visitor mistyped — almost always a hold that expired while
      // they were typing. Same outcome as the countdown reaching zero, so the
      // same teardown, with the server's own sentence.
      const kind: OrderFailureKind = Object.keys(fields).length > 0 ? 'fields' : 'blocked';

      if (kind === 'blocked') {
        this.hold.expire(failure.body?.message ?? EXPIRED_MESSAGE);
      }

      this.failureState.set({ kind, message: describe(failure), fields, contested });

      return failure;
    }

    this.failureState.set({ kind: 'error', message: describe(failure), fields, contested });

    return failure;
  }
}

/** Shown when the order is refused for a rule and the API sent no message. */
const EXPIRED_MESSAGE = 'Your hold time expired. Please re-select your seats.';

/** The API's message, or a neutral fallback for a response that carried none. */
function describe(failure: ApiError): string {
  return failure.body?.message ?? 'Could not complete the order. Please try again.';
}

/**
 * The seat codes from a `409` body.
 *
 * Identical to the hold flow's reading of the same field, and deliberately so:
 * both requests can return a conflict and both must name the same seats. Only
 * real strings are taken, so an unexpected shape degrades to "no seats named".
 */
function parseContested(failure: ApiError): string[] {
  const contested = failure.body?.contested;

  if (!Array.isArray(contested)) {
    return [];
  }

  return contested.filter((code): code is string => typeof code === 'string');
}

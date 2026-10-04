import { Component, computed, inject } from '@angular/core';
import { BookingHoldService } from '../../booking-hold.service';
import { BookingStateService } from '../../booking-state.service';
import { SeatSelectionSummary } from '../seat-selection-summary/seat-selection-summary';

/**
 * Content slot for Step 2 of the booking flow, reached only once the seats are
 * actually held.
 *
 * The checkout form, buyer details and the payment request are later tasks, so
 * this component owns the shell's content area and nothing more: a two-column
 * layout with an empty form column on the left and the read-only price summary
 * on the right, as the design sets it out. Nothing here asks for anything — the
 * hold that made this step reachable already exists, and the countdown in the
 * dialog header is counting it down.
 *
 * The summary is the same component Step 1 uses, given its seats and prices but
 * none of its controls. Reusing it means the two steps cannot show different
 * seats or different totals for the same selection, which is the failure a
 * hand-copied second summary would eventually introduce.
 */
@Component({
  imports: [SeatSelectionSummary],
  selector: 'app-booking-step-checkout',
  styleUrl: './booking-step-checkout.scss',
  templateUrl: './booking-step-checkout.html',
})
export class BookingStepCheckout {
  private readonly hold = inject(BookingHoldService);
  private readonly booking = inject(BookingStateService);

  /**
   * Whether a hold is being checked out at all.
   *
   * Step 2 exists to complete a hold, so the step and the hold are expected
   * together — an expiry returns the flow to Step 1 on its own. This is the null
   * check that keeps the layout from rendering an empty summary in the moment
   * between the hold going and the step following it back.
   */
  protected readonly hasHold = this.hold.hasHold;

  /**
   * Returns to seat selection without releasing the hold.
   *
   * The hold is deliberately kept: the visitor is changing their mind about the
   * seats, not abandoning the booking, and the API replaces the hold when they
   * submit a new selection — releasing here would only take away seats the server
   * is still holding for them.
   */
  protected backToSeats(): void {
    this.booking.showStep1();
  }
}

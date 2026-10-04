import { Component, computed, inject, input } from '@angular/core';
import { BookingHoldService } from '../../booking-hold.service';
import { SeatSelectionService } from '../../seat-selection.service';

/**
 * The panel listing the visitor's own seats: what they picked, what each costs,
 * the total, and the way onward.
 *
 * It is a separate component because the summary is a distinct responsibility
 * from the map: it never touches geometry, and the map never shows a price. Both
 * read the same {@link SeatSelectionService}, so there is no second copy of the
 * selection and no way for the two panels to disagree.
 *
 * It serves both steps. On Step 1 it is editable — ticket types can be changed,
 * seats dropped, and the forward control creates the hold. On Step 2 it is
 * rendered with {@link readOnly} set, because the seats are already held and
 * changing one now would silently disagree with what the server has reserved.
 * One component rather than two, so the steps cannot drift apart.
 *
 * Everything it shows is configuration, not copy: the ticket types come from
 * `/filter-options`, the seat cap comes from `maxSeatsPerOrder`, and each price is
 * calculated from the screening price and the ticket type's own ratio. Nothing is
 * hardcoded. Those prices are a preview; once a hold exists the server's own
 * figures replace them, which is what {@link total} prefers.
 */
@Component({
  selector: 'app-seat-selection-summary',
  styleUrl: './seat-selection-summary.scss',
  templateUrl: './seat-selection-summary.html',
})
export class SeatSelectionSummary {
  private readonly selection = inject(SeatSelectionService);
  private readonly hold = inject(BookingHoldService);

  /**
   * Whether the seats are already held and must not be edited.
   *
   * Set on Step 2, where the summary is a confirmation of what the server has
   * reserved rather than a set of choices. Every editing affordance is removed
   * in that mode, and the total switches to the server's own figure.
   */
  readonly readOnly = input(false);

  /** The selected seats, in the order they were picked, with their ticket types. */
  protected readonly lines = this.selection.lines;

  /** Ticket types this screening may sell, restricted ones already removed. */
  protected readonly ticketTypes = computed(() =>
    this.selection.availableTicketTypes().map((type) => ({
      id: type.id,
      name: type.name,
      /**
       * The type's share of the base price, as a whole percentage.
       *
       * Derived from `priceRatio` rather than written out, so the button cannot
       * claim a discount the configuration does not offer. Trailing zeros are
       * dropped, so a full-price ticket reads `100%` and not `100.0%`.
       */
      percentage: `${Math.round(type.priceRatio * 100)}%`,
    })),
  );

  /** The configured maximum seats per order. */
  protected readonly maxSeats = this.selection.maxSeats;

  /**
   * The locally calculated sum of the selected seats' prices — the Step 1
   * preview. Superseded by the hold's own subtotal once one exists; see
   * {@link total}.
   */
  protected readonly subtotal = this.selection.subtotal;

  /**
   * The total to display.
   *
   * Once a hold exists, its subtotal wins: that is the figure the server priced
   * and the one the order will be paid against. The locally calculated sum is
   * only a preview, and Step 2 is exactly the point where showing both would be
   * a way of being wrong.
   */
  protected readonly total = computed(() =>
    this.readOnly() ? (this.hold.hold()?.subtotal ?? this.subtotal()) : this.subtotal(),
  );

  /**
   * Whether the forward control is available.
   *
   * The selection's own validity, narrowed by whether a hold request is already
   * in flight, so the button cannot be pressed twice and two holds cannot be
   * created from one click. Always false in read-only mode, where the control is
   * not rendered at all.
   */
  protected readonly canContinue = computed(() => !this.readOnly() && this.hold.canSubmit());

  /** Whether a hold request is in flight; the control shows its waiting state. */
  protected readonly submitting = this.hold.submitting;

  /** Accessible notice for an action that had no effect, e.g. the seat cap. */
  protected readonly notice = this.selection.notice;

  /** Assigns a ticket type to one seat, leaving the other seats untouched. */
  protected chooseTicketType(seatId: number, ticketTypeId: number): void {
    this.selection.setTicketType(seatId, ticketTypeId);
  }

  /** Drops one seat and its ticket type from the selection. */
  protected removeSeat(seatId: number): void {
    this.selection.deselect(seatId);
  }

  /**
   * Requests a hold for the current selection and moves to checkout.
   *
   * This is where Step 1 ends and Step 2 begins, and the transition belongs to
   * {@link BookingHoldService}: it sends the request, reconciles a conflict,
   * starts the countdown, and only advances once the server has confirmed the
   * seats. Nothing about that is duplicated here — this component only reports
   * whether it may be pressed.
   */
  protected continueToCheckout(): void {
    this.hold.submit();
  }
}

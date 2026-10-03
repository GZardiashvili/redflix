import { Component, computed, inject } from '@angular/core';
import { SeatSelectionService } from '../../seat-selection.service';

/**
 * The right-hand panel of Step 1: the seats the visitor picked, the ticket type
 * and price of each, the subtotal, and the way onward to checkout.
 *
 * It is a separate component because the summary is a distinct responsibility
 * from the map: it never touches geometry, and the map never shows a price. Both
 * read the same {@link SeatSelectionService}, so there is no second copy of the
 * selection and no way for the two panels to disagree.
 *
 * Everything it shows is configuration, not copy: the ticket types come from
 * `/filter-options`, the seat cap comes from `maxSeatsPerOrder`, and each price is
 * calculated from the screening price and the ticket type's own ratio. Nothing is
 * hardcoded, and no request is made — the prices are a Step 1 preview, and the
 * hold request that makes them authoritative belongs to the next task.
 */
@Component({
  selector: 'app-seat-selection-summary',
  styleUrl: './seat-selection-summary.scss',
  templateUrl: './seat-selection-summary.html',
})
export class SeatSelectionSummary {
  private readonly selection = inject(SeatSelectionService);

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

  /** Sum of the selected seats' prices. */
  protected readonly subtotal = this.selection.subtotal;

  /** Whether Step 1 is complete and checkout may be entered. */
  protected readonly canContinue = this.selection.canContinue;

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
   * The step's forward control.
   *
   * Deliberately inert: this task ends at a valid Step 1. Creating the hold,
   * starting a countdown and moving into checkout are the next task's work, so
   * nothing is faked here — the button only reports whether the step is valid.
   */
  protected continueToCheckout(): void {}
}

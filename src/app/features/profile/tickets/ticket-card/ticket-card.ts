import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Order } from '../../../../core/models/order';

/**
 * Presentation of one server-provided order: poster, title, screening, seats,
 * ticket types and the total the server charged.
 *
 * Pure presentation — no HTTP, no state, no mutation. Every value is rendered
 * from the {@link Order} the API returned: movie title and poster from
 * `session.movie`, venue and hall from `session.venue` / `session.hall`,
 * date, time, format and language from `session`, each seat code and ticket
 * type name from `tickets[]`, and the total from `totalPrice`, formatted — like
 * the order confirmation — as lari with cents, never recomputed from the lines.
 *
 * Refund eligibility is the server's `isRefundable`, never a client-side time
 * calculation; the button emits a refund intent for the parent to confirm —
 * the card itself never calls the API.
 */
@Component({
  imports: [DatePipe],
  selector: 'app-ticket-card',
  styleUrl: './ticket-card.scss',
  templateUrl: './ticket-card.html',
})
export class TicketCard {
  /** The order to render, exactly as `GET /tickets` returned it. */
  readonly order = input.required<Order>();

  /**
   * Whether the upcoming-ticket refund affordance belongs on this card.
   *
   * True for upcoming tickets (refund button plus its cutoff note); false for
   * past tickets, which render the attended / refunded treatment instead — a
   * disabled Refund control, or a "Refunded" label when `refundedAt` is set.
   */
  readonly showRefund = input(false);

  /**
   * Whether this order's refund request is currently in flight. While true the
   * Refund control shows its loading state and stays disabled.
   */
  readonly refunding = input(false);

  /**
   * The visitor asked to refund this order. Emitted only from an enabled
   * control — never for a non-refundable order — and handled by the parent,
   * which confirms before sending any request.
   */
  readonly refundRequested = output<void>();

  /**
   * Whether this order was refunded, derived from the server's `refundedAt`.
   *
   * A non-null timestamp means the order already went through
   * `POST /orders/{order}/refund` — past cards render a "Refunded" label instead
   * of any refund action. A null value means the session simply ran its course.
   */
  protected readonly isRefunded = computed(() => this.order().refundedAt !== null);

  /**
   * The refund cutoff for this order's session: `session.startsAt` minus 2 hours.
   *
   * Refunds are allowed up to 2 hours before the session starts, so the stub
   * reads "Refundable until …" from this instant. Parsed from the server's ISO
   * `startsAt` and shifted by exactly 2 hours; `null` when the timestamp cannot
   * be parsed, in which case the template hides the note rather than printing a
   * fabricated time. Rendering stays in UTC (like the session date elsewhere on
   * the card) via the `DatePipe` timezone argument in the template.
   */
  protected readonly refundCutoff = computed<Date | null>(() => {
    const startsAt = this.order().session.startsAt;

    if (!startsAt) {
      return null;
    }

    const parsed = Date.parse(startsAt);

    if (Number.isNaN(parsed)) {
      return null;
    }

    return new Date(parsed - 2 * 60 * 60 * 1000);
  });

  /**
   * The total the server charged, in lari with cents.
   *
   * Read straight from `totalPrice` — the figure the payment actually took — and
   * only ever formatted, never recomputed from the ticket lines.
   */
  protected readonly total = computed(() => this.order().totalPrice.toFixed(2));
}

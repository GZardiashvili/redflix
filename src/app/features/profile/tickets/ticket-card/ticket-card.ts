import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
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
 * calculation; the button performs no mutation (Task 24 owns the refund call),
 * so it is rendered inert and disabled when the order is not refundable.
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
   * Whether the refund affordance belongs on this card: upcoming tickets only.
   * Past tickets render the same information with no refund action.
   */
  readonly showRefund = input(false);

  /**
   * The total the server charged, in lari with cents.
   *
   * Read straight from `totalPrice` — the figure the payment actually took — and
   * only ever formatted, never recomputed from the ticket lines.
   */
  protected readonly total = computed(() => this.order().totalPrice.toFixed(2));
}

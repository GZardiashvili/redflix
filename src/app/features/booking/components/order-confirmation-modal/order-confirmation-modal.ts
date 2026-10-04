import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Modal } from '../../../../shared/ui/modal/modal';
import { BookingOrderService } from '../../booking-order.service';

/**
 * The order confirmation dialog: what the visitor sees once `POST /orders` has
 * answered `201`.
 *
 * It is a dialog of its own rather than a third step of the booking flow,
 * because it is not a step: there is nothing to go back from, nothing to
 * advance to, and the screening header, step indicator and countdown it would
 * have inherited have all been cleared by then. The booking modal closes on the
 * same `201`, and this one takes its place over the page the visitor was
 * already on, so dismissing it returns them exactly where they were.
 *
 * **The server's order is the only thing rendered.** Reference, poster, title,
 * venue, hall, date, time, format, language, seats, ticket types and the total
 * all come from the immutable {@link Order} that `POST /orders` returned —
 * never from the hold, the selection or any other local state, all of which are
 * cleared before this view opens. Nothing is recalculated: the total is the
 * server's own `totalPrice`, not a sum of the lines.
 *
 * Dismissing it is {@link BookingOrderService.dismiss}'s decision, reached from
 * every close affordance here, so the view cannot be left half-open.
 */
@Component({
  imports: [DatePipe, Modal],
  selector: 'app-order-confirmation-modal',
  styleUrl: './order-confirmation-modal.scss',
  templateUrl: './order-confirmation-modal.html',
})
export class OrderConfirmationModal {
  private readonly orders = inject(BookingOrderService);
  private readonly router = inject(Router);

  /** The paid order, or `null` when no confirmation is waiting to be shown. */
  protected readonly order = this.orders.order;

  /** Whether the dialog is on screen: exactly while an order is undismissed. */
  protected readonly open = computed(() => this.order() !== null);

  /**
   * The total the server charged, in lari with cents.
   *
   * Read straight from `totalPrice` — the figure the payment actually took —
   * and only ever formatted, never recomputed from the ticket lines.
   */
  protected readonly total = computed(() => {
    const order = this.order();

    return order === null ? '' : order.totalPrice.toFixed(2);
  });

  /**
   * Closes the confirmation and leaves the visitor on the page underneath.
   *
   * The same call backs the Close button, the shell's close control, Escape and
   * a click on the overlay, so every exit behaves identically.
   */
  protected dismiss(): void {
    this.orders.dismiss();
  }

  /**
   * "Back to home": dismisses the confirmation and sends the visitor to the
   * landing page, where the freshly booked film is part of what is shown.
   *
   * Dismissal happens first so the dialog never lingers over the new route;
   * every other close affordance (the shell's `×`, Escape, the overlay) still
   * leaves the visitor where they were, as before.
   */
  protected backToHome(): void {
    this.dismiss();
    void this.router.navigate(['/']);
  }

  /**
   * "My Tickets": closes the confirmation first, then routes to the profile
   * page's My Tickets section.
   *
   * Dismissing before navigating keeps the dialog from lingering over the new
   * route. The section is named by the query parameter the Profile page reads,
   * so the visitor lands on the ticket list itself and that section re-reads
   * `GET /tickets`, showing the order just bought without a manual refresh.
   */
  protected showTickets(): void {
    this.dismiss();
    void this.router.navigate(['/profile'], { queryParams: { tab: 'tickets' } });
  }
}

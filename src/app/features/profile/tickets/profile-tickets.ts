import { DatePipe } from '@angular/common';
import { Component, computed, inject, model, signal } from '@angular/core';
import { Order } from '../../../core/models/order';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../../shared/ui/loading/loading-indicator';
import { Modal } from '../../../shared/ui/modal/modal';
import { TicketCard } from './ticket-card/ticket-card';
import { TicketsService } from './tickets.service';

/** The two logical ticket lists of the My Tickets section. */
export type TicketsTab = 'upcoming' | 'past';

/**
 * The My Tickets section of the Profile page: the Upcoming / Past tabs and the
 * ticket list beneath them, plus the refund confirmation flow.
 *
 * Composition and tab state live here; the `GET /tickets` request, its response
 * and its loading/error state — and the `POST /orders/{order}/refund` mutation
 * with its per-order progress — live in {@link TicketsService}. Each ticket
 * card is presentation of one server-provided order that emits a refund intent;
 * no HTTP lives inside cards.
 *
 * The combined response is fetched once and split on the server-provided
 * `isUpcoming` flag, so switching tabs never issues another request, never
 * blanks an already-rendered list, and never destroys the Personal Information
 * form above: this component is its sibling, not its replacement.
 */
@Component({
  imports: [DatePipe, EmptyState, ErrorState, LoadingIndicator, Modal, TicketCard],
  selector: 'app-profile-tickets',
  styleUrl: './profile-tickets.scss',
  templateUrl: './profile-tickets.html',
})
export class ProfileTickets {
  private readonly ticketsService = inject(TicketsService);

  /**
   * Which logical list is visible. Upcoming first, per the design. Two-way
   * bound to the page (`[(activeTab)]`) so the page owns the tab state while
   * this section renders it — switching sections never resets the tab.
   */
  readonly activeTab = model<TicketsTab>('upcoming');

  /**
   * The order awaiting refund confirmation, or `null` when no dialog is open.
   *
   * Stored as the full order — not just its reference — so the dialog can name
   * the movie, session and seats being refunded without re-reading the list.
   */
  private readonly pendingRefundState = signal<Order | null>(null);

  /** Whether the confirmed refund request is in flight. */
  private readonly confirmingState = signal(false);

  /** Rule-level failure of the confirmed refund, verbatim from the server. */
  private readonly confirmFailureState = signal<string | null>(null);

  protected readonly tickets = this.ticketsService.tickets;
  protected readonly loading = this.ticketsService.loading;
  protected readonly error = this.ticketsService.error;
  protected readonly refunding = this.ticketsService.refunding;

  protected readonly pendingRefund = this.pendingRefundState.asReadonly();
  protected readonly confirming = this.confirmingState.asReadonly();
  protected readonly confirmFailure = this.confirmFailureState.asReadonly();

  /** Whether the refund dialog is on screen. */
  protected readonly refundDialogOpen = computed(() => this.pendingRefundState() !== null);

  /**
   * Upcoming orders: paid orders whose session has not started yet, as the
   * server classified them. Never derived from the browser clock.
   */
  protected readonly upcoming = computed(
    () => this.ticketsService.tickets()?.filter((order) => order.isUpcoming) ?? [],
  );

  /**
   * Past orders: everything else, including sessions that have run and refunded
   * orders regardless of date. `refundedAt !== null` is one way to land here,
   * not the definition — the server's `isUpcoming` decides.
   */
  protected readonly past = computed(
    () => this.ticketsService.tickets()?.filter((order) => !order.isUpcoming) ?? [],
  );

  /** The list the active tab shows. */
  protected readonly visible = computed(() =>
    this.activeTab() === 'upcoming' ? this.upcoming() : this.past(),
  );

  /** The failure's own words when the server sent any, neutral fallback otherwise. */
  protected readonly errorMessage = computed(
    () => this.error()?.body?.message ?? 'Your tickets could not be loaded. Please try again.',
  );

  constructor() {
    void this.ticketsService.load();
  }

  /**
   * Switches the visible list.
   *
   * A no-op while a request is still in flight, so rapid tab clicks cannot
   * queue duplicate requests; otherwise a pure local state change, since both
   * lists already come from the single combined response.
   */
  protected selectTab(tab: TicketsTab): void {
    if (tab === this.activeTab() || this.loading()) {
      return;
    }

    this.activeTab.set(tab);
  }

  /** Re-runs the same `GET /tickets` request after a failure. */
  protected retry(): void {
    void this.ticketsService.load();
  }

  /**
   * Opens the refund confirmation for one order.
   *
   * No request is sent here — the dialog must be confirmed first. Non-refundable
   * orders never reach this (their card control is disabled), and a second
   * intent for an order already being refunded is ignored.
   */
  protected askRefund(order: Order): void {
    if (!order.isRefundable || this.ticketsService.isRefunding(order.reference)) {
      return;
    }

    this.ticketsService.clearRefundError();
    this.confirmFailureState.set(null);
    this.pendingRefundState.set(order);
  }

  /**
   * Closes the refund dialog without sending anything.
   *
   * A no-op while the confirmed request is in flight: the outcome is about to
   * arrive and must not be orphaned behind a dismissed dialog.
   */
  protected cancelRefund(): void {
    if (this.confirmingState()) {
      return;
    }

    this.pendingRefundState.set(null);
    this.confirmFailureState.set(null);
    this.ticketsService.clearRefundError();
  }

  /**
   * Sends the confirmed refund: exactly one
   * `POST /orders/{reference}/refund` per confirmation.
   *
   * Guarded against repeated clicks while the request runs. On success the
   * dialog closes and the service reconciles the server's updated order plus a
   * refreshed `GET /tickets`; on failure the server's own message stays in the
   * dialog with a retry, and the ticket data is left untouched.
   */
  protected async confirmRefund(): Promise<void> {
    const order = this.pendingRefundState();

    if (order === null || this.confirmingState()) {
      return;
    }

    this.confirmingState.set(true);
    this.confirmFailureState.set(null);

    try {
      await this.ticketsService.refund(order.reference);
      this.pendingRefundState.set(null);
    } catch (error) {
      this.confirmFailureState.set(describeRefundFailure(error));
    } finally {
      this.confirmingState.set(false);
    }
  }
}

/**
 * The message to show when a confirmed refund fails: the API's own words when
 * it sent any — including the 422 refusal and the 403 foreign-order case —
 * neutral fallback otherwise. A 401 never arrives here: the auth interceptor
 * replays it through the login flow first.
 */
function describeRefundFailure(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'body' in error) {
    const body = (error as { body?: { message?: unknown } }).body;

    if (typeof body?.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  }

  return 'Could not refund this order. Please try again.';
}

import { Component, computed, inject, signal } from '@angular/core';
import { EmptyState } from '../../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../../shared/ui/loading/loading-indicator';
import { TicketCard } from './ticket-card/ticket-card';
import { TicketsService } from './tickets.service';

/** The two logical ticket lists of the My Tickets section. */
export type TicketsTab = 'upcoming' | 'past';

/**
 * The My Tickets section of the Profile page: the Upcoming / Past tabs and the
 * ticket list beneath them.
 *
 * Composition and tab state live here; the `GET /tickets` request, its response
 * and its loading/error state live in {@link TicketsService}. Each ticket card
 * is pure presentation of one server-provided order — no HTTP inside cards.
 *
 * The combined response is fetched once and split on the server-provided
 * `isUpcoming` flag, so switching tabs never issues another request, never
 * blanks an already-rendered list, and never destroys the Personal Information
 * form above: this component is its sibling, not its replacement.
 */
@Component({
  imports: [EmptyState, ErrorState, LoadingIndicator, TicketCard],
  providers: [TicketsService],
  selector: 'app-profile-tickets',
  styleUrl: './profile-tickets.scss',
  templateUrl: './profile-tickets.html',
})
export class ProfileTickets {
  private readonly ticketsService = inject(TicketsService);

  /** Which logical list is visible. Upcoming first, per the design. */
  protected readonly activeTab = signal<TicketsTab>('upcoming');

  protected readonly tickets = this.ticketsService.tickets;
  protected readonly loading = this.ticketsService.loading;
  protected readonly error = this.ticketsService.error;

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
}

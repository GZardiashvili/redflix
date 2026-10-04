import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { ApiResponse } from '../../../core/api/api-response';
import { API_ENDPOINTS, apiUrl, orderRefundUrl } from '../../../core/config/api.config';
import { Order } from '../../../core/models/order';

/** Envelope of `GET /tickets`: the authenticated user's orders, newest session first. */
export type TicketsResponse = ApiResponse<Order[]>;

/** Envelope of `POST /orders/{order}/refund`: the updated order. */
export type RefundResponse = ApiResponse<Order>;

/**
 * Owner of the tickets endpoints: `GET /tickets` and
 * `POST /orders/{order}/refund`.
 *
 * A thin typed wrapper over `HttpClient` with feature-local request state, like
 * the other core services — no caching beyond the current response, no error
 * interpretation, no second user state.
 *
 * The request is intentionally made **without** a `filter` query parameter: the
 * API contract documents that an unfiltered response already carries both
 * `upcoming` and `past` orders, and no supported filter values could be verified
 * against the authoritative contract or the production endpoint (every
 * unauthenticated probe answers `401 Unauthenticated`, which proves nothing
 * about accepted values). Inventing `?filter=upcoming` / `?filter=past` would
 * invent a contract, so the single combined response is fetched once and split
 * client-side on the server-provided `isUpcoming` flag.
 *
 * Like every authenticated endpoint, a `401` is handled by the existing auth
 * interceptor: it opens the login modal and replays the request once, so the
 * tickets feature never sees a bare 401 and needs no ticket-specific login
 * handling.
 */
@Service()
export class TicketsService {
  private readonly http = inject(HttpClient);

  private readonly ticketsState = signal<readonly Order[] | null>(null);
  private readonly loadingState = signal(false);
  private readonly failureState = signal<ApiError | null>(null);

  /**
   * References of orders with a refund request currently in flight.
   *
   * A set rather than a single flag: while one order is being refunded the rest
   * of the list stays interactive, and a second click on the *same* order is
   * still impossible.
   */
  private readonly refundingState = signal<readonly string[]>([]);
  private readonly refundFailureState = signal<{ reference: string; error: ApiError } | null>(null);

  /** Last successful `GET /tickets` response, or `null` before the first success. */
  readonly tickets = this.ticketsState.asReadonly();

  /** Whether a `GET /tickets` request is in flight. */
  readonly loading = this.loadingState.asReadonly();

  /** Normalised failure of the last tickets request, or `null` when there is none. */
  readonly error = this.failureState.asReadonly();

  /** References of orders currently being refunded. */
  readonly refunding = this.refundingState.asReadonly();

  /** Failure of the last refund request, with the order it belongs to. */
  readonly refundError = this.refundFailureState.asReadonly();

  /** Number of upcoming orders in the current response, for the tab badge. */
  readonly upcomingCount = computed(
    () => this.ticketsState()?.filter((order) => order.isUpcoming).length ?? 0,
  );

  /**
   * Fetches the authenticated user's tickets.
   *
   * A no-op while a request is already in flight, so rapid tab clicks cannot
   * produce uncontrolled duplicate requests. The previous successful response is
   * kept while reloading, so tab switches never blank a list that already
   * rendered.
   */
  async load(): Promise<void> {
    if (this.loadingState()) {
      return;
    }

    this.loadingState.set(true);
    this.failureState.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<TicketsResponse>(apiUrl(API_ENDPOINTS.tickets)),
      );

      this.ticketsState.set(response.data);
    } catch (error) {
      this.failureState.set(toApiError(error));
    } finally {
      this.loadingState.set(false);
    }
  }

  /**
   * Whether a refund request for this order is currently in flight.
   *
   * Read by the ticket list to disable the order's own Refund control while its
   * request runs — every other order stays interactive.
   */
  isRefunding(reference: string): boolean {
    return this.refundingState().includes(reference);
  }

  /**
   * Refunds one order: `POST /orders/{order}/refund`, where `{order}` is the
   * order **reference**, with no request body.
   *
   * A rejected no-op while a refund for the same reference is already in
   * flight, so repeated clicks cannot create duplicate refund requests. Throws
   * the normalised {@link ApiError} on failure so the caller can render the
   * server's own message; a `401` never reaches the caller — the auth
   * interceptor replays it through the login flow first.
   *
   * On success the returned updated order is reconciled into the collection and
   * the list is then refreshed from `GET /tickets`, so Upcoming/Past membership
   * is definitively the server's — never an optimistic local deletion and never
   * a forced `isUpcoming = false`.
   */
  async refund(reference: string): Promise<Order> {
    if (this.isRefunding(reference)) {
      throw toApiError(new Error('A refund for this order is already in progress.'));
    }

    this.refundingState.update((refs) => [...refs, reference]);
    this.refundFailureState.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<RefundResponse>(orderRefundUrl(reference), null),
      );

      this.ticketsState.update((tickets) =>
        tickets === null
          ? [response.data]
          : tickets.some((order) => order.reference === response.data.reference)
            ? tickets.map((order) =>
                order.reference === response.data.reference ? response.data : order,
              )
            : [response.data, ...tickets],
      );

      await this.reloadAfterRefund();

      return response.data;
    } catch (error) {
      const failure = toApiError(error);
      this.refundFailureState.set({ reference, error: failure });
      throw failure;
    } finally {
      this.refundingState.update((refs) => refs.filter((ref) => ref !== reference));
    }
  }

  /** Clears the refund failure, e.g. when its dialog is dismissed. */
  clearRefundError(): void {
    this.refundFailureState.set(null);
  }

  /**
   * Re-reads the tickets on demand, bypassing the in-flight guard.
   *
   * Used when the visitor has just bought a ticket and opens My Tickets: the
   * response already in memory cannot contain the new order, and a request that
   * happens to be running was issued before the purchase.
   */
  async reload(): Promise<void> {
    await this.reloadAfterRefund();
  }

  /** Refreshes the collection after a refund without the duplicate guard. */
  private async reloadAfterRefund(): Promise<void> {
    this.loadingState.set(true);

    try {
      const response = await firstValueFrom(
        this.http.get<TicketsResponse>(apiUrl(API_ENDPOINTS.tickets)),
      );

      this.ticketsState.set(response.data);
      this.failureState.set(null);
    } catch (error) {
      this.failureState.set(toApiError(error));
    } finally {
      this.loadingState.set(false);
    }
  }
}

import { HttpClient } from '@angular/common/http';
import { Service, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { ApiResponse } from '../../../core/api/api-response';
import { API_ENDPOINTS, apiUrl } from '../../../core/config/api.config';
import { Order } from '../../../core/models/order';

/** Envelope of `GET /tickets`: the authenticated user's orders, newest session first. */
export type TicketsResponse = ApiResponse<Order[]>;

/**
 * Owner of the tickets endpoint: `GET /tickets`.
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

  /** Last successful `GET /tickets` response, or `null` before the first success. */
  readonly tickets = this.ticketsState.asReadonly();

  /** Whether a `GET /tickets` request is in flight. */
  readonly loading = this.loadingState.asReadonly();

  /** Normalised failure of the last request, or `null` when there is none. */
  readonly error = this.failureState.asReadonly();

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
}

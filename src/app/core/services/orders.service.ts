import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import { OrderRequest, OrderResponse } from '../models/order';

/**
 * Owner of the order endpoint: `POST /orders`.
 *
 * Thin typed wrapper over `HttpClient`, like the other core services — no state,
 * no caching and no error interpretation.
 *
 * Like every booking endpoint this one is authenticated, so a `401` is handled by
 * the existing auth interceptor: it opens the login modal and replays the request
 * once. The booking feature therefore never sees a bare 401.
 */
@Service()
export class OrdersService {
  private readonly http = inject(HttpClient);

  /**
   * Pays for a hold and creates the order: `POST /orders`, answering `201` with
   * the complete order.
   *
   * The `holdId` is the whole link between the payment and the seats; the server
   * prices the tickets from the hold, so the payload carries no seat or price
   * data of its own. Re-submitting one hold cannot produce two orders.
   *
   * Three failures are resolved by the caller rather than here:
   *
   * * `422` **with** `errors` — per-field validation. Each entry names a form
   *   control and carries the API's own message for it, shown verbatim.
   * * `422` **without** `errors` — a booking rule blocked the order, almost
   *   always because the hold expired while the visitor was filling in the form.
   *   Only a `message` is returned.
   * * `409` — the seats went to someone else between the hold and the payment.
   *   The body carries `contested` seat codes to reconcile against.
   */
  createOrder(request: OrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(apiUrl(API_ENDPOINTS.orders), request);
  }
}

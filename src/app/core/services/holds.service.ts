import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { holdUrl, sessionHoldsUrl } from '../config/api.config';
import { HoldRequest, HoldResponse } from '../models/hold';

/**
 * Reusable owner of the booking hold endpoints used by the booking flow.
 *
 * Thin typed wrappers over `HttpClient`, like the other core services: no
 * caching, no state and no second API abstraction. {@link BookingHoldService}
 * owns everything about the hold's lifecycle — when it is created, counted
 * down, replaced and released — and calls these methods.
 *
 * Both endpoints are authenticated, so a `401` is handled by the existing auth
 * interceptor: it opens the login modal and replays the request once. The
 * feature layer therefore never sees a bare 401 and never opens a second login
 * flow of its own.
 */
@Service()
export class HoldsService {
  private readonly http = inject(HttpClient);

  /**
   * Reserves seats for a screening: `POST /sessions/{session}/holds`.
   *
   * `{session}` is the numeric session id from the booking context. The body
   * sends each seat's **ticket type slug** (`adult`, `child`, `student`), not
   * the numeric id the `/filter-options` configuration uses — the two are
   * deliberately different vocabularies, so `HoldRequestSeat.ticketType`
   * documents it at the call site.
   *
   * Two failures are resolved by the caller rather than here:
   *
   * * `409` — the seat map moved on and some seats are already taken. The body
   *   carries `contested` seat codes to reconcile against.
   * * `422` — a booking rule blocked the request (the session already started,
   *   for example) and only a `message` is returned.
   *
   * Both propagate to the caller, which owns the selection and the map.
   */
  createHold(sessionId: number, seats: HoldRequest['seats']): Observable<HoldResponse> {
    const body: HoldRequest = { seats };

    return this.http.post<HoldResponse>(sessionHoldsUrl(sessionId), body);
  }

  /**
   * Releases one hold: `DELETE /holds/{hold}`, answering `204 No Content`.
   *
   * Releases the seats back onto the map immediately rather than waiting for the
   * countdown to run out. Returns an empty `Observable<void>`; an already
   * expired or unknown hold fails with `404`, which callers releasing in the
   * background treat as "nothing left to free".
   */
  releaseHold(holdId: string): Observable<void> {
    return this.http.delete<void>(holdUrl(holdId));
  }
}

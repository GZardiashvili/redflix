import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import { SessionsQuery, SessionsResponse } from '../models/session';

/**
 * Owner of the `GET /sessions` showtime catalogue.
 *
 * A thin typed wrapper over `HttpClient`: no caching, no state — the page owns
 * loading/empty/error state. Array filters must reach the backend in bracket
 * notation (`venues[]=galleria`), which `HttpParams.append` serializes
 * key-by-key; empty/absent values are skipped so the API keeps its defaults.
 */
@Service()
export class SessionsService {
  private readonly http = inject(HttpClient);

  /** Showtimes grouped by movie for the requested date and filters. */
  getSessions(query: SessionsQuery = {}): Observable<SessionsResponse> {
    return this.http.get<SessionsResponse>(apiUrl(API_ENDPOINTS.sessions), {
      params: toParams(query),
    });
  }
}

/** Maps a query object onto `HttpParams`, skipping absent or empty values. */
function toParams(query: SessionsQuery): HttpParams {
  let params = new HttpParams();

  if (query.date) {
    params = params.set('date', query.date);
  }

  if (query.search) {
    params = params.set('search', query.search);
  }

  if (query.sort) {
    params = params.set('sort', query.sort);
  }

  if (query.page !== undefined) {
    params = params.set('page', String(query.page));
  }

  params = appendAll(params, 'venues[]', query.venues);
  params = appendAll(params, 'formats[]', query.formats);
  params = appendAll(params, 'languages[]', query.languages);
  params = appendAll(params, 'bands[]', query.bands);

  return params;
}

/** Appends every value of an array filter under the same bracketed key. */
function appendAll(params: HttpParams, key: string, values: string[] = []): HttpParams {
  return values.reduce((all, value) => all.append(key, value), params);
}

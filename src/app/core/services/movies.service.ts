import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiResponse } from '../api/api-response';
import {
  API_ENDPOINTS,
  apiUrl,
  movieSessionsUrl,
  movieUrl,
  notifyMovieUrl,
  sessionSeatsUrl,
} from '../config/api.config';
import { Movie, MovieDetail, MovieNotifyResponse } from '../models/movie';
import { SessionSeatsResponse } from '../models/seat';
import { MovieSessionsResponse } from '../models/session';

/**
 * Reusable owner of the movie catalogue endpoints.
 *
 * Thin typed wrappers over `HttpClient`: no caching, no state, no second API
 * abstraction. Features own their loading/error state and call these methods
 * with the limits their layout needs.
 */
@Service()
export class MoviesService {
  private readonly http = inject(HttpClient);

  /** Hero titles flagged as featured (a bookable subset of now-playing). */
  getFeatured(): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.featuredMovies);
  }

  /** Movies currently showing, capped for the Home grid when `limit` is set. */
  getNowPlaying(limit?: number): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.nowPlayingMovies, limit);
  }

  /** Unreleased titles (no sessions); `limit` caps the Home row. */
  getComingSoon(limit?: number): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.comingSoonMovies, limit);
  }

  /**
   * Catalogue search for the header typeahead.
   *
   * The API matches prefixes and caps the page at 6 items itself; an empty or
   * unmatched query resolves to an empty array, never an error.
   */
  async search(query: string): Promise<Movie[]> {
    const params = new HttpParams().set('q', query);
    const response = await firstValueFrom(
      this.http.get<ApiResponse<Movie[]>>(apiUrl(API_ENDPOINTS.search), { params }),
    );

    return response.data;
  }

  /**
   * A single movie by slug: `GET /movies/{movie}`.
   *
   * The path segment is the slug, never the id — the API 404s an id-based path.
   * `404` and other failures propagate so the feature layer can distinguish
   * "not found" from a transport or server error.
   */
  async getMovie(slug: string): Promise<MovieDetail> {
    const response = await firstValueFrom(this.http.get<ApiResponse<MovieDetail>>(movieUrl(slug)));

    return response.data;
  }

  /**
   * A movie's showtimes on one date: `GET /movies/{movie}/sessions?date=YYYY-MM-DD`.
   *
   * The path segment is the slug and `date` is a local calendar day, exactly as on
   * the Sessions page. An empty `data` array is a success — a coming-soon movie has
   * no sessions on any date — so the caller gets `[]` rather than a failure.
   *
   * Returns an Observable (not the Promise style used above) because the Movie
   * Details page switches between dates and needs the previous request cancelled:
   * `switchMap` unsubscribes the in-flight one instead of racing it.
   */
  getMovieSessions(movieSlug: string, date: string): Observable<MovieSessionsResponse> {
    const params = new HttpParams().set('date', date);

    return this.http.get<MovieSessionsResponse>(movieSessionsUrl(movieSlug), { params });
  }

  /**
   * A screening's hall layout: `GET /sessions/{session}/seats`.
   *
   * `{session}` is the numeric session id the booking flow is holding — never a
   * movie slug or id. The endpoint is public; when a token happens to be sent the
   * API additionally flags the visitor's own held seats through `isMine`, so
   * authenticated requests work unchanged.
   *
   * Failures (including `401`, which the auth interceptor replays through the
   * existing login flow) propagate to the caller rather than being swallowed, so
   * the feature can show a real error and retry.
   */
  getSessionSeats(sessionId: number): Observable<SessionSeatsResponse> {
    return this.http.get<SessionSeatsResponse>(sessionSeatsUrl(sessionId));
  }

  /**
   * Subscribes the current user to release notifications for a movie.
   *
   * A duplicate subscription resolves with the server's `subscribed: true`
   * state instead of failing; `401` and `404` propagate for the feature layer
   * to surface (the 401 replay flow is handled by the auth interceptor).
   */
  async notifyMovie(movieSlug: string): Promise<MovieNotifyResponse> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<MovieNotifyResponse>>(notifyMovieUrl(movieSlug), null),
    );

    return response.data;
  }

  private async getMovies(
    endpoint:
      | typeof API_ENDPOINTS.featuredMovies
      | typeof API_ENDPOINTS.nowPlayingMovies
      | typeof API_ENDPOINTS.comingSoonMovies,
    limit?: number,
  ): Promise<Movie[]> {
    let params = new HttpParams();

    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }

    const response = await firstValueFrom(
      this.http.get<ApiResponse<Movie[]>>(apiUrl(endpoint), { params }),
    );

    return response.data;
  }
}

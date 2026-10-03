import { ApiResponse } from '../api/api-response';
import { Format, Language } from './filter-options';
import { Movie } from './movie';

/**
 * Domain models for `GET /sessions`: showtimes grouped by movie.
 *
 * The endpoint returns an array of `{ movie, sessions }` groups (one group per
 * movie, 10 movies per page) plus a `meta` block; pagination counts movies,
 * not individual sessions. Mirrors the live payload exactly.
 */

/** Time of day a showtime falls into; also the value set of the `bands[]` filter. */
export type SessionTimeBand = 'morning' | 'afternoon' | 'evening';

/** Auditorium a session plays in. The venue itself travels on the session. */
export interface SessionHall {
  id: number;
  name: string;
}

/**
 * Venue summary attached to a session. Slimmer than the `/filter-options`
 * `Venue` (no nested format list), so it is modelled separately.
 */
export interface SessionVenue {
  id: number;
  slug: string;
  name: string;
  city: string;
}

/** One concrete showtime of a movie. */
export interface MovieSession {
  id: number;
  startsAt: string;
  date: string;
  time: string;
  timeBand: SessionTimeBand;
  price: number;
  seatsLeft: number;
  isSoldOut: boolean;
  hall: SessionHall;
  venue: SessionVenue;
  format: Format;
  language: Language;
}

/** A movie together with its sessions, as grouped by the API. */
export interface MovieSessionGroup {
  movie: Movie;
  sessions: MovieSession[];
}

/**
 * One venue's sessions of a single movie, as returned by
 * `GET /movies/{movie}/sessions`. The same session records as `/sessions` —
 * only the grouping differs, so {@link MovieSession} is reused rather than
 * duplicated.
 */
export interface VenueSessions {
  venue: SessionVenue;
  sessions: MovieSession[];
}

/** Envelope of `GET /movies/{movie}/sessions`: venue groups for one date. */
export type MovieSessionsResponse = ApiResponse<VenueSessions[]>;

/** Pagination and date block returned alongside `data`. */
export interface SessionsMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  totalSessions: number;
  totalMovies: number;
  date: string;
}

/**
 * Query parameters supported by `GET /sessions`. Array filters serialize as
 * `venues[]=…&formats[]=…` (bracket notation the backend expects).
 */
export interface SessionsQuery {
  /** `YYYY-MM-DD`; defaults to today on the server. */
  date?: string;
  venues?: string[];
  formats?: string[];
  languages?: string[];
  bands?: SessionTimeBand[];
  /** Free-text match on the film title. */
  search?: string;
  /** Sort id owned by the API (`time_asc` by default). */
  sort?: string;
  /** 1-based page; pages count movies. */
  page?: number;
}

/** Envelope of `GET /sessions`: grouped data plus the pagination metadata. */
export type SessionsResponse = ApiResponse<MovieSessionGroup[]> & { meta: SessionsMeta };

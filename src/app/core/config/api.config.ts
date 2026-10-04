/**
 * Central API configuration.
 *
 * The Kino XII API base URL lives here only, so endpoint URLs are never duplicated
 * across core services or features.
 */
export const API_BASE_URL = 'https://api.kinoxii.redberryinternship.ge/api';

/** Endpoint paths, relative to {@link API_BASE_URL}. */
export const API_ENDPOINTS = {
  filterOptions: 'filter-options',
  login: 'login',
  register: 'register',
  logout: 'logout',
  me: 'me',
  search: 'search',
  sessions: 'sessions',
  featuredMovies: 'movies/featured',
  nowPlayingMovies: 'movies/now-playing',
  comingSoonMovies: 'movies/coming-soon',
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];

/** Builds the absolute URL of an API endpoint. */
export function apiUrl(endpoint: ApiEndpoint): string {
  return `${API_BASE_URL}/${endpoint}`;
}

/**
 * Builds the absolute URL of a single movie: `GET /movies/{movie}`, where `{movie}`
 * is the movie **slug** (the API 404s an id-based path).
 */
export function movieUrl(movieSlug: string): string {
  return `${API_BASE_URL}/movies/${encodeURIComponent(movieSlug)}`;
}

/**
 * Builds the absolute URL of a movie's showtimes: `GET /movies/{movie}/sessions`,
 * where `{movie}` is the movie **slug** (the API 404s an id-based path).
 */
export function movieSessionsUrl(movieSlug: string): string {
  return `${movieUrl(movieSlug)}/sessions`;
}

/**
 * Builds the absolute URL of a screening's seat map:
 * `GET /sessions/{session}/seats`.
 *
 * `{session}` is the **numeric session id** that comes from the booking context
 * — never a movie slug or movie id, which this endpoint does not accept.
 */
export function sessionSeatsUrl(sessionId: number): string {
  return `${API_BASE_URL}/sessions/${encodeURIComponent(String(sessionId))}/seats`;
}

/**
 * Builds the absolute URL of a session's hold endpoint:
 * `POST /sessions/{session}/holds`.
 *
 * `{session}` is the **numeric session id** from the booking context, the same
 * identifier the seat map uses.
 */
export function sessionHoldsUrl(sessionId: number): string {
  return `${API_BASE_URL}/sessions/${encodeURIComponent(String(sessionId))}/holds`;
}

/**
 * Builds the absolute URL of a single hold: `GET /holds/{hold}` and
 * `DELETE /holds/{hold}`.
 *
 * `{hold}` is the hold's own uuid, never a session id.
 */
export function holdUrl(holdId: string): string {
  return `${API_BASE_URL}/holds/${encodeURIComponent(holdId)}`;
}

/**
 * Builds the absolute URL of the notification subscription endpoint:
 * `POST /movies/{movie}/notify`, where `{movie}` is the movie **slug**
 * (the API 404s an id-based path).
 */
export function notifyMovieUrl(movieSlug: string): string {
  return `${movieUrl(movieSlug)}/notify`;
}

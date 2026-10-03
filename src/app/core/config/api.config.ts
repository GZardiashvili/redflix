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
 * Builds the absolute URL of the notification subscription endpoint:
 * `POST /movies/{movie}/notify`, where `{movie}` is the movie **slug**
 * (the API 404s an id-based path).
 */
export function notifyMovieUrl(movieSlug: string): string {
  return `${API_BASE_URL}/movies/${encodeURIComponent(movieSlug)}/notify`;
}

/**
 * Envelope used by every Kino XII API response: the payload is always wrapped in `data`.
 */
export interface ApiResponse<T> {
  data: T;
}

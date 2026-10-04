import { AgeRating, Format } from './filter-options';

/**
 * Movie summary returned by the catalogue endpoints (`/movies/featured`,
 * `/movies/now-playing`, `/movies/coming-soon` and later `/search`).
 *
 * Mirrors the API contract exactly. `synopsis` is marked optional because the
 * contract only guarantees the long description on `GET /movies/{movie}` — the
 * catalogue endpoints send it for most titles but nothing promises it — so it is
 * read defensively and never invented.
 */
export interface Movie {
  id: number;
  slug: string;
  title: string;
  kind: string;
  runtimeMinutes: number;
  posterUrl: string;
  backdropUrl: string;
  releaseDate: string;
  isComingSoon: boolean;
  isNotified: boolean;
  isFeatured: boolean;
  fromPrice: number;
  ageRating: AgeRating;
  genres: Genre[];
  formats: Format[];
  /**
   * Long description. Optional on the summary: `GET /movies/{movie}` always sends
   * it (as `MovieDetail` requires), while the catalogue endpoints send it for most
   * titles only, so consumers must handle its absence rather than assume it.
   */
  synopsis?: string | null;
}

/** A movie genre. */
export interface Genre {
  id: number;
  slug: string;
  name: string;
}

/**
 * The single category a card shows for a movie, `''` when it has none.
 *
 * The card rows have room for one label beside the runtime, and the design's
 * cards carry a single category, so the API's own first genre is taken and the
 * rest are left to the details page, which lists them all.
 */
export function primaryGenre(genres: readonly Genre[]): string {
  return genres[0]?.name ?? '';
}

/**
 * Full movie record returned by `GET /movies/{movie}`.
 *
 * It extends the catalogue {@link Movie} with the three fields only the detail
 * endpoint sends — the summary shape is a strict subset, so a detail response is
 * also a valid `Movie` (which is what Recently Viewed and the notify flow store).
 */
export interface MovieDetail extends Movie {
  /**
   * Long description, always present on this endpoint — even when the API has no
   * copy, in which case it is empty/`null`. Narrowed from the summary's optional
   * field so the details page can read it without a null check on the field itself.
   */
  synopsis: string | null;
  /** Director credit, as the API supplies it. */
  director: string | null;
  /**
   * Lead cast as a single formatted string, e.g. `"A. Name, B. Name"`. The API
   * ships one string rather than a cast list, so it is displayed as given.
   */
  cast: string | null;
  /** Days the movie plays, `YYYY-MM-DD`. Empty for a coming-soon title. */
  availableDates: string[];
}

/**
 * Successful payload of `POST /movies/{movie}/notify`.
 *
 * `subscribed` is the server's authoritative subscription state and may be
 * `true` again for a duplicate request, which is not an error.
 */
export interface MovieNotifyResponse {
  movieId: number;
  subscribed: boolean;
}

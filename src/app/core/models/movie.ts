import { AgeRating, Format } from './filter-options';

/**
 * Movie summary returned by the catalogue endpoints (`/movies/featured`,
 * `/movies/now-playing`, `/movies/coming-soon` and later `/search`).
 *
 * Mirrors the API contract exactly. Note the API also sends a `synopsis` on
 * some responses; it is deliberately omitted here because the contract says
 * the Home summary must not manufacture details payload — the full
 * description/director/cast model belongs to the future Movie Details task.
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
}

/** A movie genre. */
export interface Genre {
  id: number;
  slug: string;
  name: string;
}

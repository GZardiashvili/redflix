/**
 * Domain models for `GET /filter-options`, the application-wide source of truth for filter
 * and booking configuration.
 *
 * These interfaces mirror the API contract exactly: every list is owned by the API and must
 * never be hardcoded in features.
 */

/** A cinema venue, together with the formats it actually offers. */
export interface Venue {
  id: number;
  slug: string;
  name: string;
  city: string;
  formats: Format[];
}

/** A projection format (Standard, MAX, ATMOS, ...) and its surcharge in Georgian lari. */
export interface Format {
  id: number;
  slug: string;
  name: string;
  priceUplift: number;
}

/** A language option (dub or subtitles), with the short badge code of the design. */
export interface Language {
  id: number;
  slug: string;
  name: string;
  /** Short badge label, e.g. `ENG`. */
  code: string;
}

/** A time-of-day band for filtering showtimes; the id values are owned by the API. */
export interface TimeBand {
  id: string;
  label: string;
}

/** A session sort option; the id values are owned by the API. */
export interface SortOption {
  id: string;
  label: string;
}

/** A ticket category and the ratio applied to the base seat price. */
export interface TicketType {
  id: number;
  slug: string;
  name: string;
  priceRatio: number;
  note: string | null;
  blockedFromRatingAge: number | null;
}

/** A film age rating. */
export interface AgeRating {
  code: string;
  minAge: number;
  description: string;
}

/** Complete `/filter-options` payload, including the booking limits owned by the API. */
export interface FilterOptions {
  venues: Venue[];
  formats: Format[];
  languages: Language[];
  timeBands: TimeBand[];
  sorts: SortOption[];
  ticketTypes: TicketType[];
  ageRatings: AgeRating[];
  maxSeatsPerOrder: number;
  holdMinutes: number;
}

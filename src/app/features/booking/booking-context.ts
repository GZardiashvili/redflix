import { AgeRating } from '../../core/models/filter-options';

/**
 * Everything the booking flow needs to identify the screening being booked.
 *
 * Built once from the Task 15 `MovieSession` that the visitor picked, so the
 * session id stays the single identifier the later booking requests will use and
 * no second movie/session representation is fetched for the header.
 *
 * The movie's age rating travels here as well: Step 1 needs it to decide which
 * ticket types a screening may sell, and the details page already holds the
 * rating, so carrying it costs no extra request.
 */
export interface BookingContext {
  /** Canonical identifier of the screening, used by every later booking request. */
  readonly sessionId: number;
  /** ISO timestamp the screening starts at. */
  readonly startsAt: string;
  /** Local calendar day, `YYYY-MM-DD`. */
  readonly date: string;
  /** Start time as the API reports it, e.g. `16:30`. */
  readonly time: string;
  /** Ticket price in GEL. */
  readonly price: number;
  readonly venueName: string;
  readonly hallName: string;
  readonly movieSlug: string;
  readonly movieTitle: string;
  /**
   * Lowest age allowed to buy this movie, e.g. `16`.
   *
   * The rating decides which ticket types this screening may sell, so it travels
   * with the screening instead of being looked up again.
   */
  readonly ageRatingMinAge: number;
  readonly formatName: string;
  readonly languageName: string;
  /** Short language badge code of the design, e.g. `ENG`. */
  readonly languageCode: string;
}

/** The movie identity the details page already has in hand when booking starts. */
export interface BookingMovie {
  readonly slug: string;
  readonly title: string;
  /** The movie's own rating, used by the ticket rules in Step 1. */
  readonly ageRating: AgeRating;
}

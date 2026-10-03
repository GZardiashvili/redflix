/**
 * Everything the booking flow needs to identify the screening being booked.
 *
 * Built once from the Task 15 `MovieSession` that the visitor picked, so the
 * session id stays the single identifier the later booking requests will use and
 * no second movie/session representation is fetched for the header.
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
  readonly formatName: string;
  readonly languageName: string;
  /** Short language badge code of the design, e.g. `ENG`. */
  readonly languageCode: string;
}

/** The movie identity the details page already has in hand when booking starts. */
export interface BookingMovie {
  readonly slug: string;
  readonly title: string;
}

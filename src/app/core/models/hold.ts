import { ApiResponse } from '../api/api-response';

/**
 * Domain models for the booking hold endpoints used by the booking flow:
 * `POST /sessions/{session}/holds` and `DELETE /holds/{hold}`.
 *
 * A hold is the server's authoritative record of the seats the visitor has
 * temporarily reserved: which seats, with which ticket type, at what price, and
 * until exactly when. It is the first response in the flow that carries prices
 * the client did not calculate, so nothing about a held ticket is derived here.
 */

/** The ticket type a held seat was sold as, as the API names it. */
export interface HoldTicketType {
  /** Slug used when requesting a hold, e.g. `adult`, `child`, `student`. */
  readonly slug: string;
  readonly name: string;
}

/** One seat inside a hold. */
export interface HoldSeat {
  readonly seatId: number;
  /** Seat code, e.g. `E7`; the same identity the seat map renders. */
  readonly code: string;
  readonly ticketType: HoldTicketType;
  /** Price of this seat in GEL, as priced by the server. */
  readonly price: number;
}

/** A live or expired hold of one session's seats. */
export interface Hold {
  /** Identifier used by `GET /holds/{hold}` and `DELETE /holds/{hold}`. */
  readonly holdId: string;
  readonly sessionId: number;
  /**
   * ISO timestamp the hold expires at, as the server's clock reports it.
   *
   * This — not {@link secondsRemaining} — is what a countdown must be measured
   * against: it is a point in time, so a throttled or backgrounded tab that
   * misses ticks still shows the correct time once it wakes up.
   */
  readonly expiresAt: string;
  /**
   * Server's own remaining-seconds reading at the moment of the response.
   *
   * Advisory only: it is already stale by the time the response is rendered.
   */
  readonly secondsRemaining: number;
  /** Whether the hold is still live; `false` once the server has released it. */
  readonly isLive: boolean;
  /** Server-computed total for the whole hold, in GEL. */
  readonly subtotal: number;
  readonly seats: readonly HoldSeat[];
}

/** Envelope of `POST /sessions/{session}/holds` (201). */
export type HoldResponse = ApiResponse<Hold>;

/** One seat as requested when creating a hold. */
export interface HoldRequestSeat {
  readonly seatId: number;
  /** Ticket type **slug**, not its id: `adult`, `child` or `student`. */
  readonly ticketType: string;
}

/** Body of `POST /sessions/{session}/holds`. */
export interface HoldRequest {
  readonly seats: readonly HoldRequestSeat[];
}

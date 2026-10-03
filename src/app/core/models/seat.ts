import { ApiResponse } from '../api/api-response';
import { SessionHall } from './session';

/**
 * Domain models for `GET /sessions/{session}/seats`: the hall layout of one
 * screening.
 *
 * The API's `sections → rows → seats` hierarchy is modelled exactly as sent and
 * is never flattened. The four halls genuinely differ — different section names,
 * different row counts, and rows of 6 to 14 seats with gaps and gangways in
 * different places — so a generic rectangular grid would misstate the geometry.
 */

/**
 * Availability of one seat, exactly as the API reports it.
 *
 * * `available` — bookable.
 * * `sold` — sold out; it stays visible.
 * * `held` — temporarily taken by another visitor's live hold. Deliberately a
 *   separate state from `sold`: a hold expires and frees the seat, so merging
 *   them would tell the visitor something untrue.
 * * `unavailable` — **not a disabled seat**: there is physically nothing in that
 *   position (a gangway, a wheelchair space, a structural gap). It renders as
 *   empty space so the row keeps its real width.
 */
export type SeatState = 'available' | 'sold' | 'held' | 'unavailable';

/** One seat of one row. */
export interface Seat {
  /** Seat id; the identifier future hold requests will use. */
  readonly id: number;
  /** Stable seat identity, e.g. `A7`. */
  readonly code: string;
  /** Short number printed in the seat, e.g. `7`. */
  readonly label: string;
  readonly state: SeatState;
  /**
   * Whether a gangway follows this seat.
   *
   * Purely visual, and sent per seat because the gap sits in a different place in
   * every section — inferring "every fourth seat" would misplace it.
   */
  readonly aisleAfter: boolean;
  /**
   * Whether this seat belongs to the current visitor's own live hold.
   *
   * Only true when the request carries a token. Recovering that hold is the
   * hold-lifecycle task's job, so this is preserved and rendered as-is here.
   */
  readonly isMine: boolean;
}

/** One row of a section. */
export interface SeatRow {
  /**
   * Row label as the API sends it, e.g. `A`.
   *
   * Labels are not contiguous across sections: the API may send `A`–`G` and then
   * continue at `J`, so this is rendered verbatim and never derived from an
   * index or completed alphabetically.
   */
  readonly label: string;
  readonly seats: readonly Seat[];
}

/** One block of the hall, e.g. `Stalls`, `Balcony`, `Circle`, `Boxes`. */
export interface SeatSection {
  readonly name: string;
  readonly rows: readonly SeatRow[];
}

/** The hall layout of one screening. */
export interface SessionSeatMap {
  readonly sessionId: number;
  readonly hall: SessionHall;
  readonly sections: readonly SeatSection[];
}

/** Envelope of `GET /sessions/{session}/seats`. */
export type SessionSeatsResponse = ApiResponse<SessionSeatMap>;

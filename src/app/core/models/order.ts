import { ApiResponse } from '../api/api-response';
import { HoldTicketType } from './hold';
import { Movie } from './movie';
import { MovieSession, SessionHall, SessionVenue } from './session';

/**
 * Domain models for `POST /orders`: the completed purchase.
 *
 * An order is the server's own record of what was bought — its reference, the
 * money actually charged, and the tickets as they were issued. It is modelled
 * exactly as returned, and nothing about it is recalculated here: the price on
 * the order is the price that was paid, not the Step 1 preview the hold
 * replaced.
 */

/** The buyer details captured with the order, as the server recorded them. */
export interface OrderContact {
  readonly fullName: string;
  readonly email: string;
  readonly mobileNumber: string;
}

/** One issued ticket of an order. */
export interface OrderTicket {
  readonly id: number;
  /** Seat code the ticket is for, e.g. `A1`. */
  readonly seatCode: string;
  readonly ticketType: HoldTicketType;
  /** Price charged for this ticket, in GEL. */
  readonly price: number;
}

/** Lifecycle of an order as the API reports it. */
export type OrderStatus = 'paid' | 'refunded';

/**
 * The movie an order's session is for, as the order carries it inline.
 *
 * The catalogue {@link Movie} without the genre and format lists: `POST /orders`
 * attaches the whole screening — movie included — to the order, and those two
 * lists are the only fields it does not send. Modelling the difference rather
 * than reusing `Movie` keeps a reader from reaching for `order.session.movie.genres`
 * and finding nothing there.
 */
export type OrderMovie = Omit<Movie, 'genres' | 'formats'>;

/**
 * The hall an order's session plays in.
 *
 * The same `SessionHall` the other session payloads use, plus the venue again,
 * nested one level down — the API sends it both here and as `session.venue`.
 * Both are modelled as returned; the confirmation reads `session.venue`, which
 * is the same record.
 */
export interface OrderHall extends SessionHall {
  readonly venue: SessionVenue;
}

/**
 * The screening an order is for: the session record of `GET /sessions` with the
 * movie attached inline rather than grouped beside it, which is what lets the
 * confirmation render poster, title and screening from the order alone — no
 * second request, and no reading of local booking state that has since been
 * cleared.
 */
export interface OrderSession extends MovieSession {
  readonly hall: OrderHall;
  readonly movie: OrderMovie;
}

/** A completed order. */
export interface Order {
  readonly id: number;
  /**
   * Human-facing order reference, e.g. `KX-OFDYH5`.
   *
   * This is what the visitor is shown and quoted on, so it is stored verbatim
   * and never reconstructed from the id.
   */
  readonly reference: string;
  readonly status: OrderStatus;
  /** Total actually charged, in GEL. Server-computed. */
  readonly totalPrice: number;
  readonly paidAt: string;
  readonly refundedAt: string | null;
  readonly isUpcoming: boolean;
  readonly isRefundable: boolean;
  /**
   * Last four digits of the card that paid.
   *
   * The only trace of the card the order keeps: the full number is never part of
   * the response and must never be stored or displayed by the client.
   */
  readonly cardLastFour: string;
  readonly contact: OrderContact;
  /** The screening the tickets are for, with the movie attached inline. */
  readonly session: OrderSession;
  readonly tickets: readonly OrderTicket[];
}

/** Envelope of `POST /orders` (201). */
export type OrderResponse = ApiResponse<Order>;

/** Body of `POST /orders`. */
export interface OrderRequest {
  /** The hold being paid for; the only thing tying the order to the seats. */
  readonly holdId: string;
  readonly fullName: string;
  readonly email: string;
  readonly mobileNumber: string;
  /** 16 digits, with or without spaces — the API accepts both. */
  readonly cardNumber: string;
  /** Card expiry as `MM/YY`. */
  readonly expiry: string;
  /** 3-digit card security code. */
  readonly cvv: string;
}

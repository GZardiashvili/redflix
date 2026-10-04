import { ApiResponse } from '../api/api-response';
import { HoldTicketType } from './hold';
import { MovieSession } from './session';

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
  /** The screening the tickets are for. */
  readonly session: MovieSession;
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

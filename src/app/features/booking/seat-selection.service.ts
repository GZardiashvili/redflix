import { Service, computed, effect, inject, signal } from '@angular/core';
import { TicketType } from '../../core/models/filter-options';
import { Seat } from '../../core/models/seat';
import { FilterOptionsService } from '../../core/services/filter-options.service';
import { BookingStateService } from './booking-state.service';

/**
 * One seat the visitor has picked, stored as the smallest possible fact set.
 *
 * Only the seat's identity and its ticket type are kept. Everything else a line
 * needs — the ticket type's own name and ratio, the screening price, whether the
 * movie's rating forbids that ticket type — is configuration that can change
 * under the selection, so it is resolved by {@link SeatSelectionService.lines}
 * rather than frozen into the stored value. A stored copy could claim a price
 * for a ticket type that is no longer offered.
 */
export interface SeatSelection {
  readonly seatId: number;
  /** Seat code such as `B3`, kept so the summary does not depend on the map. */
  readonly code: string;
  readonly ticketTypeId: number;
}

/** A selected seat resolved against the current configuration and screening. */
export interface SelectedSeatLine {
  readonly seatId: number;
  readonly code: string;
  /** The configured ticket type, or `null` if it has disappeared since selection. */
  readonly ticketType: TicketType | null;
  /** Locally calculated price for this seat, in GEL. Stays numeric. */
  readonly price: number;
  /** Whether this seat's ticket assignment satisfies every configured rule. */
  readonly valid: boolean;
  /** Why this seat is invalid, shown beside it; `null` while it is valid. */
  readonly invalidReason: string | null;
}

/**
 * Slug of the ticket type a newly selected seat defaults to. Owned by the API.
 */
const DEFAULT_TICKET_TYPE_SLUG = 'adult';

/**
 * One seat the server is already holding for this visitor, in the hold
 * response's vocabulary.
 *
 * `GET /holds/{hold}` names a ticket type by **slug** (`adult`) while selection
 * stores the configuration's numeric id, so the two vocabularies are kept apart
 * here rather than blurred together in a method signature.
 */
export interface HeldSeat {
  readonly seatId: number;
  readonly code: string;
  readonly ticketTypeSlug: string;
}

/**
 * The seats picked in Step 1 and everything derived from them.
 *
 * This is the single source of truth for selection. Seat components do not own
 * any of it: they receive the ids that are selected and emit the seats the
 * visitor activates, so the map stays presentational and the rules — the seat
 * cap, the default ticket type, the age-rating restriction, the pricing — live
 * in exactly one place.
 *
 * Three properties matter:
 *
 * * **Ordering is explicit.** The selection is an array, so the summary follows
 *   the order the seats were picked in rather than whatever key order a record
 *   happens to produce. Re-picking a seat appends it to the end.
 * * **The server map is never touched.** Selection is client state layered over
 *   the immutable seat-map response; a seat's `state` still means what the API
 *   said it means.
 * * **It cannot outlive its screening.** The selection is cleared whenever the
 *   booking context changes, so seats chosen for one screening never appear on
 *   another — including when the booking closes.
 *
 * Prices here are a Step 1 preview computed from the screening's own price and
 * the configured ratio. No hold exists yet, and no server pricing is consulted.
 */
@Service()
export class SeatSelectionService {
  private readonly booking = inject(BookingStateService);
  private readonly filterOptions = inject(FilterOptionsService);

  private readonly selectionState = signal<readonly SeatSelection[]>([]);
  private readonly noticeState = signal<string | null>(null);

  /** Every configured ticket type, in the order the API sent them. */
  readonly ticketTypes = computed(() => this.filterOptions.value()?.ticketTypes ?? []);

  /**
   * The configured maximum seats per order.
   *
   * `0` while `/filter-options` has not loaded, which blocks selection rather
   * than silently allowing an unbounded number of seats.
   */
  readonly maxSeats = computed(() => this.filterOptions.value()?.maxSeatsPerOrder ?? 0);

  /** Minimum age of the movie being booked, `0` when the context carries none. */
  private readonly movieMinAge = computed(() => this.booking.context()?.ageRatingMinAge ?? 0);

  /** The ticket types this screening may sell, restricted ones removed. */
  readonly availableTicketTypes = computed(() => {
    const minAge = this.movieMinAge();

    return this.ticketTypes().filter((type) => this.blockReason(type, minAge) === null);
  });

  /**
   * The selected seats as displayable lines, in selection order.
   *
   * Prices are numeric and recomputed from the current screening price and the
   * current ratio, so a stale number can never survive a configuration change.
   * A seat whose ticket type is no longer offered becomes an invalid line with a
   * reason rather than disappearing, because the seat is still selected.
   */
  readonly lines = computed<readonly SelectedSeatLine[]>(() => {
    const price = this.booking.context()?.price ?? 0;
    const minAge = this.movieMinAge();
    const types = this.ticketTypes();

    return this.selectionState().map((selection) => {
      const ticketType = types.find((type) => type.id === selection.ticketTypeId) ?? null;
      const reason =
        ticketType === null
          ? 'This ticket type is no longer available for this screening.'
          : this.blockReason(ticketType, minAge);

      return {
        seatId: selection.seatId,
        code: selection.code,
        ticketType,
        price: ticketType === null ? 0 : roundPrice(price * ticketType.priceRatio),
        valid: reason === null,
        invalidReason: reason,
      };
    });
  });

  /** Ids of the selected seats, for the map to mark as selected. */
  readonly selectedSeatIds = computed(() => new Set(this.lines().map((line) => line.seatId)));

  /** Sum of the selected seats' prices. */
  readonly subtotal = computed(() =>
    roundPrice(this.lines().reduce((total, line) => total + line.price, 0)),
  );

  /**
   * Whether Step 1 is complete.
   *
   * Derived from the selection itself rather than assumed from the UI: at least
   * one seat, within the configured cap, and every seat carrying a valid ticket
   * type. The cap is already enforced on selection, but validity must not depend
   * on that — a selection that somehow became inconsistent has to read as invalid.
   */
  readonly canContinue = computed(() => {
    const lines = this.lines();

    return lines.length > 0 && lines.length <= this.maxSeats() && lines.every((line) => line.valid);
  });

  /**
   * Message for the visitor about why their last action had no effect, or
   * `null`. Rendered in a live region so it is announced, not just drawn.
   */
  readonly notice = this.noticeState.asReadonly();

  constructor() {
    // The selection belongs to one screening. Reading the session id is what makes
    // this re-run: a new booking starts empty, and closing the dialog clears it.
    effect(() => {
      this.booking.context()?.sessionId ?? null;
      this.clear();
    });
  }

  /**
   * Selects an available seat, or deselects it when it is already selected.
   *
   * Selecting is refused — leaving the current selection untouched — when the
   * configured cap is already reached or no ticket type is available to assign.
   * Refusals set {@link notice}; every accepted change clears it, so a stale
   * warning never outlives the selection that caused it.
   */
  toggle(seat: Seat): void {
    if (seat.state !== 'available') {
      return;
    }

    if (this.isSelected(seat.id)) {
      this.deselect(seat.id);
      return;
    }

    if (this.selectionState().length >= this.maxSeats()) {
      this.noticeState.set(
        `You can select at most ${this.maxSeats()} ${plural(this.maxSeats(), 'seat')}.`,
      );
      return;
    }

    const ticketType = this.defaultTicketType();

    if (ticketType === null) {
      this.noticeState.set('Ticket types are unavailable right now. Please try again.');
      return;
    }

    this.selectionState.update((selection) => [
      ...selection,
      { seatId: seat.id, code: seat.code, ticketTypeId: ticketType.id },
    ]);
    this.noticeState.set(null);
  }

  /** Removes a seat from the selection along with its ticket type and validity. */
  deselect(seatId: number): void {
    this.selectionState.update((selection) => selection.filter((entry) => entry.seatId !== seatId));
    this.noticeState.set(null);
  }

  /**
   * Replaces the selection with seats the server is already holding.
   *
   * Used only to resume a hold that outlived a reload: the seats, their codes and
   * their ticket types come straight from `GET /holds/{hold}`, so nothing about
   * them is guessed or re-derived. The hold's **slug** is resolved against the
   * current configuration, because selection stores the configured id; a slug the
   * configuration no longer lists falls back to the default type rather than
   * leaving a held seat with no type at all, and with no configuration at all
   * nothing is restored — a seat without a ticket type could never be bought, so
   * pretending to hold one would only surface later as a broken line.
   */
  restoreHeld(seats: readonly HeldSeat[]): void {
    const fallback = this.defaultTicketType();

    if (seats.length === 0 || fallback === null) {
      this.clear();
      return;
    }

    const types = this.ticketTypes();

    this.selectionState.set(
      seats.map((seat) => ({
        seatId: seat.seatId,
        code: seat.code,
        ticketTypeId: types.find((type) => type.slug === seat.ticketTypeSlug)?.id ?? fallback.id,
      })),
    );
    this.noticeState.set(null);
  }

  /**
   * Drops every selected seat carrying one of the given seat codes.
   *
   * Used when the hold request is answered with `409`: the API names the seats
   * it could not give us, and only those may leave the selection. Seats the
   * visitor did win are still theirs, so removing by code — rather than
   * clearing the selection — is what keeps the uncontested part of the order
   * intact and lets the visitor try again with just those seats.
   *
   * Unknown codes are ignored, so a code the local map never had cannot remove
   * anything. Codes are matched exactly: seat codes are the API's own stable
   * identity (`A7`), not a position on screen.
   */
  removeByCodes(codes: readonly string[]): void {
    const lost = new Set(codes);

    if (lost.size === 0) {
      return;
    }

    this.selectionState.update((selection) => selection.filter((entry) => !lost.has(entry.code)));
  }
  /**
   * Assigns a ticket type to one seat, leaving every other seat untouched.
   *
   * An unknown ticket type id is ignored rather than stored, so the selection can
   * only ever hold something that exists in the configuration.
   */
  setTicketType(seatId: number, ticketTypeId: number): void {
    if (!this.ticketTypes().some((type) => type.id === ticketTypeId)) {
      return;
    }

    this.selectionState.update((selection) =>
      selection.map((entry) => (entry.seatId === seatId ? { ...entry, ticketTypeId } : entry)),
    );
    this.noticeState.set(null);
  }

  /** Whether a seat is currently selected. */
  isSelected(seatId: number): boolean {
    return this.selectionState().some((entry) => entry.seatId === seatId);
  }

  /** Drops the whole selection and any outstanding notice. */
  clear(): void {
    this.selectionState.set([]);
    this.noticeState.set(null);
  }

  /**
   * The ticket type a newly selected seat defaults to: the configured type whose
   * slug is `adult`. Derived from the configuration, so a selected seat can never
   * exist without a ticket type. If the API ever stopped sending an adult type
   * the first configured type is used, and with no configuration at all no seat
   * can be selected.
   */
  private defaultTicketType(): TicketType | null {
    const types = this.ticketTypes();

    return types.find((type) => type.slug === DEFAULT_TICKET_TYPE_SLUG) ?? types[0] ?? null;
  }

  /**
   * Why a ticket type may not be sold for this screening, or `null` when it may.
   *
   * The rule comes from the configuration: a type carrying `blockedFromRatingAge`
   * is blocked once the movie's own rating minimum reaches it. With the current
   * configuration that keeps child tickets off 16+ and 18+ films, but nothing
   * about `16` or `child` is written here — both are API values.
   *
   * Validation lives beside the configuration rather than in the template so an
   * assignment that was already invalid still reads as invalid, instead of
   * depending on the option having been hidden from the visitor.
   */
  private blockReason(type: TicketType, movieMinAge: number): string | null {
    if (type.blockedFromRatingAge === null || movieMinAge < type.blockedFromRatingAge) {
      return null;
    }

    return type.note ?? `${type.name} tickets are not available for films rated ${movieMinAge}+.`;
  }
}

/** Rounds a GEL amount to whole cents, so binary floats cannot leak into totals. */
function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

/** English plural for a counted noun: `1 seat`, `3 seats`. */
function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

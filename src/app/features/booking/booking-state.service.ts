import { Service, computed, signal } from '@angular/core';
import { BookingContext } from './booking-context';

/**
 * Explicit states of the booking flow.
 *
 * `opening` is the hand-off state between "the visitor asked to book" and "the
 * first step is on screen". It exists so the flow always has a representable
 * state there; the shell does no asynchronous work of its own, so it moves on
 * immediately.
 */
export type BookingStatus = 'closed' | 'opening' | 'step1' | 'step2';

/** One state of the flow: the status plus the screening it belongs to. */
export interface BookingState {
  readonly status: BookingStatus;
  /** The screening being booked; `null` only while the flow is closed. */
  readonly context: BookingContext | null;
}

/**
 * Single source of truth for the booking flow: whether the modal is open, which
 * step is showing and which screening is being booked.
 *
 * The screening travels with the state instead of living in a step, so moving
 * from Step 1 to Step 2 never disturbs it. {@link close} drops it completely, so
 * reopening always starts cleanly with a freshly picked screening.
 *
 * There is deliberately no state library and no async work here: seats, holds and
 * checkout arrive in later tasks and will drive these same transitions.
 */
@Service()
export class BookingStateService {
  private readonly stateSignal = signal<BookingState>({ status: 'closed', context: null });

  /** The whole state, for consumers that branch on it. */
  readonly state = this.stateSignal.asReadonly();

  /** Whether the booking modal is showing. */
  readonly isOpen = computed(() => this.stateSignal().status !== 'closed');

  /** The screening being booked, or `null` while closed. */
  readonly context = computed(() => this.stateSignal().context);

  /** Current status; `closed` when the modal is not showing. */
  readonly status = computed(() => this.stateSignal().status);

  /** Whether Step 1 (seats) is the visible step. */
  readonly isStep1 = computed(() => this.stateSignal().status === 'step1');

  /** Whether Step 2 (checkout) is the visible step. */
  readonly isStep2 = computed(() => this.stateSignal().status === 'step2');

  /** Opens the flow for a screening and lands on Step 1. */
  startBooking(context: BookingContext): void {
    this.stateSignal.set({ status: 'opening', context });
    this.showStep1();
  }

  /** Moves to the seat-selection step. */
  showStep1(): void {
    this.apply((context) => ({ status: 'step1', context }));
  }

  /** Moves to the checkout step. */
  showStep2(): void {
    this.apply((context) => ({ status: 'step2', context }));
  }

  /**
   * Closes the flow and discards the transient booking state.
   *
   * No hold exists yet — holds are created in a later task — so closing contacts
   * the API not at all and simply returns the visitor to the page underneath.
   */
  close(): void {
    this.stateSignal.set({ status: 'closed', context: null });
  }

  /** Applies a transition, but only while a screening is loaded. */
  private apply(update: (context: BookingContext) => BookingState): void {
    const current = this.stateSignal();

    if (current.context === null) {
      return;
    }

    this.stateSignal.set(update(current.context));
  }
}

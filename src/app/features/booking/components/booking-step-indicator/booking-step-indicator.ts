import { Component, computed, inject, input, output } from '@angular/core';
import { BookingHoldService } from '../../booking-hold.service';
import { SeatSelectionService } from '../../seat-selection.service';
import { BookingStatus } from '../../booking-state.service';

/** One entry of the indicator, in the order the design lists them. */
interface BookingStep {
  readonly status: Exclude<BookingStatus, 'closed' | 'opening'>;
  readonly label: string;
}

/**
 * The two steps, in order. Fixed copy: the flow has exactly these two steps.
 *
 * Uppercase and unnumbered, as the design's pill shows them — the filled half
 * already says which step the visitor is on, so a position would only repeat it.
 */
const STEPS: readonly BookingStep[] = [
  { status: 'step1', label: 'SEATS' },
  { status: 'step2', label: 'CHECKOUT' },
];

/**
 * Progress tabs of the booking flow: `SEATS → CHECKOUT`, with the active
 * step filled and the other one muted.
 *
 * The tabs navigate. Returning to SEATS from CHECKOUT keeps the hold — the
 * visitor is changing their mind about the seats, not abandoning the booking,
 * and the hold service replaces the hold when a new selection is submitted.
 * Moving forward to CHECKOUT is guarded: it only works when Step 1 is valid
 * and a hold is active, so the tabs cannot reach a step that has nothing to
 * check out.
 */
@Component({
  selector: 'app-booking-step-indicator',
  styleUrl: './booking-step-indicator.scss',
  templateUrl: './booking-step-indicator.html',
})
export class BookingStepIndicator {
  private readonly hold = inject(BookingHoldService);
  private readonly selection = inject(SeatSelectionService);

  /** Current status of the booking flow; decides which step is active. */
  readonly active = input.required<BookingStatus>();

  /** The visitor asked to go back to seat selection; the hold is kept. */
  readonly backToSeats = output<void>();

  /** The visitor asked to go forward to checkout; the hold already exists. */
  readonly forwardToCheckout = output<void>();

  /** The steps, each flagged with whether it is the active one. */
  protected readonly steps = computed(() =>
    STEPS.map((step) => ({ ...step, isActive: step.status === this.active() })),
  );

  /**
   * Whether a tab may be activated.
   *
   * The active step is never clickable — it is where the visitor already is.
   * SEATS is always reachable from CHECKOUT because the hold survives the trip
   * back. CHECKOUT is reachable from SEATS only when Step 1 is valid and a
   * hold is active, so the tabs cannot open an empty checkout.
   */
  protected canActivate(status: BookingStep['status']): boolean {
    if (status === this.active()) {
      return false;
    }

    if (status === 'step1') {
      return this.active() === 'step2';
    }

    return this.selection.canContinue() && this.hold.hasHold();
  }

  /** Emits the navigation the tab asked for, when the tab may be activated. */
  protected activate(status: BookingStep['status']): void {
    if (!this.canActivate(status)) {
      return;
    }

    if (status === 'step1') {
      this.backToSeats.emit();
      return;
    }

    this.forwardToCheckout.emit();
  }
}

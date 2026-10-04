import { Component, computed, input } from '@angular/core';
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
 * Progress bar of the booking flow: `SEATS → CHECKOUT`, with the active
 * step filled and the other one muted.
 *
 * Presentational: it renders whichever status the booking state reports and
 * never changes it. Moving between steps is booking state, not navigation, so
 * there is deliberately no link, button or route behind these labels.
 */
@Component({
  selector: 'app-booking-step-indicator',
  styleUrl: './booking-step-indicator.scss',
  templateUrl: './booking-step-indicator.html',
})
export class BookingStepIndicator {
  /** Current status of the booking flow; decides which step is active. */
  readonly active = input.required<BookingStatus>();

  /** The steps, each flagged with whether it is the active one. */
  protected readonly steps = computed(() =>
    STEPS.map((step) => ({ ...step, isActive: step.status === this.active() })),
  );
}

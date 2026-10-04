import { Component, computed, inject } from '@angular/core';
import { BookingHoldService } from '../../booking-hold.service';

/**
 * The countdown of the active hold, shown in the booking dialog's header.
 *
 * Renders nothing at all while no hold exists: there is no countdown to show on
 * Step 1, and an empty placeholder would be read as a hold that has already run
 * out. Once a hold exists it renders for as long as the hold does, which is the
 * whole of Step 2.
 *
 * Presentational in the strict sense — it holds no timer, no interval and no
 * copy of the remaining time. Both the digits and the urgency state come from
 * {@link BookingHoldService}, which derives them from the server's `expiresAt`
 * on every tick. A second timer here could only ever disagree with the one that
 * decides when the hold is released.
 *
 * The digits are announced as a `timer` rather than a live region: a live region
 * would read the remaining time aloud every second, which is unusable. The
 * accessible name carries the same information in words, and the red state is
 * not signalled by colour alone — the label below the digits says so.
 */
@Component({
  selector: 'app-hold-timer',
  styleUrl: './hold-timer.scss',
  templateUrl: './hold-timer.html',
})
export class HoldTimer {
  private readonly hold = inject(BookingHoldService);

  /** The remaining time as `MM:SS`, or `null` when there is no hold. */
  protected readonly remaining = this.hold.formattedRemaining;

  /** Whether the last minute is running out; the design's red state. */
  protected readonly urgent = this.hold.isUrgent;

  /**
   * The timer in words, for the accessible name.
   *
   * Derived from the same remaining seconds as the digits, so the spoken and
   * shown values cannot fall out of step.
   */
  protected readonly spokenRemaining = computed(() => {
    const seconds = this.hold.secondsRemaining();

    if (seconds === null) {
      return '';
    }

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;

    return minutes === 0 ? `${rest} seconds` : `${minutes} minutes ${rest} seconds`;
  });
}

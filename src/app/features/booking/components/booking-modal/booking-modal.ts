import { Component, computed, inject } from '@angular/core';
import { Modal } from '../../../../shared/ui/modal/modal';
import { BookingContext } from '../../booking-context';
import { BookingHoldService } from '../../booking-hold.service';
import { BookingStateService } from '../../booking-state.service';
import { BookingHeader } from '../booking-header/booking-header';
import { BookingStepCheckout } from '../booking-step-checkout/booking-step-checkout';
import { BookingStepIndicator } from '../booking-step-indicator/booking-step-indicator';
import { BookingStepSeats } from '../booking-step-seats/booking-step-seats';
import { HoldTimer } from '../hold-timer/hold-timer';

/**
 * The booking dialog: the shared modal shell carrying the screening header, the
 * step indicator and the content of the active step.
 *
 * The dialog is mounted once by the application shell and is entirely driven by
 * {@link BookingStateService}: it renders whatever status that state reports and
 * asks the state to close when the visitor dismisses it. It holds no booking
 * state of its own, so the Movie Details page and the shell cannot disagree
 * about which screening is being booked.
 *
 * The hold countdown is projected into the shared shell's header aside. It is
 * presentational — it reads the hold's own state — so the dialog does not
 * compute a remaining time, and the shell does not know what a hold is.
 *
 * Closing is where the dialog does one thing of its own: it releases an active
 * hold first, so the seats the visitor was reserving are freed immediately
 * instead of sitting unavailable until the countdown runs out. The release is
 * fired in the background and does not delay the close.
 */
@Component({
  imports: [
    BookingHeader,
    BookingStepCheckout,
    BookingStepIndicator,
    BookingStepSeats,
    HoldTimer,
    Modal,
  ],
  selector: 'app-booking-modal',
  styleUrl: './booking-modal.scss',
  templateUrl: './booking-modal.html',
})
export class BookingModal {
  private readonly booking = inject(BookingStateService);
  private readonly hold = inject(BookingHoldService);

  /** Whether the dialog is showing. Owned by the booking state. */
  protected readonly open = this.booking.isOpen;

  /** Current status of the flow, which decides the active step. */
  protected readonly status = this.booking.status;

  /**
   * The screening being booked.
   *
   * `null` while the flow is closed, so the title needs a fallback for the
   * dialog's accessible name; nothing is rendered in that state anyway.
   */
  protected readonly context = this.booking.context;

  /** Movie title, used as the dialog's accessible name. */
  protected readonly title = computed(() => this.context()?.movieTitle ?? 'Booking');

  /**
   * Closes the booking, releasing any active hold first.
   *
   * One place handles every way out — the close button, Escape and a click on
   * the overlay all arrive here from the shared shell — so none of them can
   * leave seats reserved by accident.
   *
   * The release is fired and forgotten, and the dialog closes straight away: a
   * visitor who has abandoned a booking should not be kept waiting on a
   * background request to free seats that the countdown would free anyway.
   */
  protected close(): void {
    this.hold.release();
    this.booking.close();
  }
}

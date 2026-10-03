import { Component, computed, inject } from '@angular/core';
import { Modal } from '../../../../shared/ui/modal/modal';
import { BookingContext } from '../../booking-context';
import { BookingStateService } from '../../booking-state.service';
import { BookingHeader } from '../booking-header/booking-header';
import { BookingStepCheckout } from '../booking-step-checkout/booking-step-checkout';
import { BookingStepIndicator } from '../booking-step-indicator/booking-step-indicator';
import { BookingStepSeats } from '../booking-step-seats/booking-step-seats';

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
 * No hold countdown is shown yet: holds do not exist in this task, and a timer
 * that cannot tick would be worse than none. It belongs beside the title in
 * Step 2's header once holds do exist.
 */
@Component({
  imports: [BookingHeader, BookingStepCheckout, BookingStepIndicator, BookingStepSeats, Modal],
  selector: 'app-booking-modal',
  styleUrl: './booking-modal.scss',
  templateUrl: './booking-modal.html',
})
export class BookingModal {
  private readonly booking = inject(BookingStateService);

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
   * Closes the booking.
   *
   * No request is made: there is no hold to release yet, and closing must not
   * touch the movie or session data behind the dialog.
   */
  protected close(): void {
    this.booking.close();
  }
}

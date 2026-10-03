import { Component, computed, input, output } from '@angular/core';
import { MovieSession } from '../../../../core/models/session';

/** Seats at or below this count render the low-availability red. */
const LOW_SEATS = 5;

/**
 * One showtime as a 252×104 card: time, format chip, language,
 * `Venue · Hall`, price and the remaining-seats badge.
 *
 * Sold-out sessions stay visible but disabled (opacity 0.4), so the time
 * remains legible as required by the API rules. The pill is presentational:
 * it emits `select` and the page owns whatever happens next (the booking flow
 * arrives in a later task).
 */
@Component({
  selector: 'app-session-time-pill',
  styleUrl: './session-time-pill.scss',
  templateUrl: './session-time-pill.html',
})
export class SessionTimePill {
  /** Showtime rendered by this pill. */
  readonly session = input.required<MovieSession>();

  /** The pill was clicked; never fires for sold-out pills (they disable). */
  readonly select = output<MovieSession>();

  /** `Galleria Tbilisi · Hall D` */
  protected readonly place = computed(
    () => `${this.session().venue.name} · Hall ${this.session().hall.name}`,
  );

  /** Whether the seats badge should warn about low availability. */
  protected readonly isLow = computed(
    () => !this.session().isSoldOut && this.session().seatsLeft <= LOW_SEATS,
  );

  /**
   * One-line description for assistive technology: the visual layout splits
   * the details across rows, so the pill announces them as a sentence.
   */
  protected readonly ariaLabel = computed(() => {
    const session = this.session();
    const availability = session.isSoldOut ? 'sold out' : `${session.seatsLeft} seats left`;

    return `${session.time}, ${session.format.name}, ${session.language.name}, ${this.place()}, ₾${session.price}, ${availability}`;
  });
}

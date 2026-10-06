import { Component, computed, input, output } from '@angular/core';
import { MovieSession } from '../../../../core/models/session';

/** Seats below this count render the low-availability red; >= this stays green. */
const LOW_SEATS_THRESHOLD = 10;

/**
 * One showtime as a 252×104 card: time, format chip, language,
 * `Venue · Hall`, price and the remaining-seats badge.
 *
 * Sold-out sessions stay visible but disabled (opacity 0.4), so the time
 * remains legible as required by the API rules. The same is true for a session
 * the current account is too young for: `ageRestricted` is passed in rather than
 * derived here, so the page owns the eligibility check and this component stays
 * presentational.
 */
@Component({
  selector: 'app-session-time-pill',
  styleUrl: './session-time-pill.scss',
  templateUrl: './session-time-pill.html',
})
export class SessionTimePill {
  /** Showtime rendered by this pill. */
  readonly session = input.required<MovieSession>();

  /**
   * Whether this pill is inert. A sold-out pill is always inert; an
   * age-restricted one is inert because the page says so.
   */
  readonly disabled = input(false);

  /** Whether `disabled` comes from the film's age rating rather than availability. */
  readonly ageRestricted = input(false);

  /** Why an age-restricted pill cannot be booked; shown as its tooltip. */
  readonly restrictionReason = input('');

  /** The pill was clicked; never fires for a disabled pill. */
  readonly select = output<MovieSession>();

  /** `Galleria Tbilisi · Hall D` */
  protected readonly place = computed(
    () => `${this.session().venue.name} · Hall ${this.session().hall.name}`,
  );

  /** Whether the seats badge should warn about low availability (< 10 seats). */
  protected readonly isLow = computed(
    () => !this.session().isSoldOut && this.session().seatsLeft < LOW_SEATS_THRESHOLD,
  );

  /**
   * One-line description for assistive technology: the visual layout splits
   * the details across rows, so the pill announces them as a sentence.
   */
  protected readonly ariaLabel = computed(() => {
    const session = this.session();
    const availability = session.isSoldOut ? 'sold out' : `${session.seatsLeft} seats left`;
    const age =
      this.ageRestricted() && this.restrictionReason() ? `. ${this.restrictionReason()}` : '';

    return `${session.time}, ${session.format.name}, ${session.language.name}, ${this.place()}, ₾${session.price}, ${availability}${age}`;
  });
}

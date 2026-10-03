import { Component, computed, input } from '@angular/core';
import { BookingContext } from '../../booking-context';

/** Long weekday and month names, matching the design's `Tuesday 15 September`. */
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Screening line of the booking dialog: the one-line description of the screening
 * being booked, which sits directly under the movie title.
 *
 * The title itself is the dialog's accessible name and is rendered by the shared
 * dialog shell, so this component only carries the metadata line.
 *
 * Every value comes from the {@link BookingContext} built from the picked
 * `MovieSession`, so nothing is hardcoded and no second request is made to fill
 * the header in.
 */
@Component({
  selector: 'app-booking-header',
  styleUrl: './booking-header.scss',
  templateUrl: './booking-header.html',
})
export class BookingHeader {
  /** The screening being booked. */
  readonly context = input.required<BookingContext>();

  /**
   * The screening as the design writes it, e.g.
   * `Galleria Tbilisi · Hall B · Tuesday 15 September · 16:30 · Standard · Original + Subtitles`.
   *
   * The date is read from the string parts of the API's calendar day rather than
   * through `new Date(...)`, which would shift the day for viewers east of UTC.
   */
  protected readonly summary = computed(() => {
    const context = this.context();

    return [
      context.venueName,
      `Hall ${context.hallName}`,
      describeDate(context.date),
      context.time,
      context.formatName,
      context.languageName,
    ]
      .filter((part) => part !== '')
      .join(' · ');
  });
}

/** Formats a `YYYY-MM-DD` day as `Tuesday 15 September`, or `''` if malformed. */
function describeDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);

  if (match === null) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  const weekday = WEEKDAYS_LONG[new Date(year, month - 1, day).getDay()];

  return `${weekday} ${day} ${MONTHS_LONG[month - 1]}`;
}

/**
 * Local-time date helpers for the Sessions feature.
 *
 * Showtimes are keyed by a calendar day (`YYYY-MM-DD`) that must be the local day
 * the user sees, so everything here formats from the local `Date` parts instead of
 * `Date#toISOString()`, which would shift the day for any timezone east of UTC.
 */

/** Short weekday names, indexed by `Date#getDay()`. */
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Full weekday names, indexed by `Date#getDay()`. */
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Full month names, indexed by `Date#getMonth()`. */
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

/** Number of days offered by the date selector. */
export const DATE_SELECTOR_DAYS = 7;

/** One selectable showtime day. */
export interface SessionDateOption {
  /** `YYYY-MM-DD` in local time. */
  iso: string;
  /** Short weekday, e.g. `Mon`. */
  weekday: string;
  /** Day of the month, e.g. `14`. */
  day: string;
  /** Spoken label for assistive technology, e.g. `Monday, 14 September`. */
  label: string;
}

/** The given date (defaults to now) as a local `YYYY-MM-DD` string. */
export function toIsoDate(date: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today as a local `YYYY-MM-DD` string. */
export function todayIso(): string {
  return toIsoDate();
}

/**
 * The `count` upcoming days starting from today, inclusive, as selector options.
 * Days are advanced with `Date#setDate`, so month and year roll over correctly.
 */
export function upcomingDateOptions(count: number = DATE_SELECTOR_DAYS): SessionDateOption[] {
  const today = new Date();

  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return toOption(date);
  });
}

function toOption(date: Date): SessionDateOption {
  const weekdayIndex = date.getDay();

  return {
    iso: toIsoDate(date),
    weekday: WEEKDAYS_SHORT[weekdayIndex],
    day: String(date.getDate()),
    label: `${WEEKDAYS_LONG[weekdayIndex]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}`,
  };
}

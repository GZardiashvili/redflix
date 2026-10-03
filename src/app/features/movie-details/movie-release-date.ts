/**
 * Presentation helpers for a movie's release date.
 *
 * `releaseDate` is a calendar day (`YYYY-MM-DD`), not a timestamp, so it is read
 * from its string parts: passing it through `new Date(...)` would shift the day
 * for viewers east of UTC.
 */

/** Full month names, indexed by 1–12. */
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
 * Formats `releaseDate` in the design's shape, e.g. `4 September 2026`.
 *
 * Month names are fixed rather than taken from `toLocaleDateString`, whose output
 * would follow the visitor's locale instead of the design. A malformed or absent
 * value yields an empty string so the row can be omitted rather than print
 * "Invalid Date".
 */
export function formatReleaseDate(isoDate: string | null | undefined): string {
  if (typeof isoDate !== 'string') {
    return '';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (match === null) {
    return '';
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }

  return `${day} ${MONTHS_LONG[month - 1]} ${year}`;
}

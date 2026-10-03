import { Params } from '@angular/router';
import { toIsoDate, todayIso } from '../session-date';

/**
 * Filter and date state of the Sessions page as it travels in the URL.
 *
 * Keeping the (de)serialization here means the page and its children never deal
 * with raw strings, and the URL shape lives in exactly one place.
 */
export interface SessionsUrlState {
  /** `YYYY-MM-DD`; falls back to today when absent or malformed. */
  date: string;
  venues: string[];
  formats: string[];
  languages: string[];
  bands: string[];
}

/** Canonical key written for each category. */
const DATE_KEY = 'date';
const VENUE_KEY = 'venue';
const FORMAT_KEY = 'format';
const LANGUAGE_KEY = 'language';
const BAND_KEY = 'band';

/**
 * Keys accepted when reading. The plural forms are tolerated as aliases so a URL
 * hand-written from the earlier `?venues=…` example still resolves.
 */
const VENUE_KEYS = [VENUE_KEY, 'venues'] as const;
const FORMAT_KEYS = [FORMAT_KEY, 'formats'] as const;
const LANGUAGE_KEYS = [LANGUAGE_KEY, 'languages'] as const;
const BAND_KEYS = [BAND_KEY, 'bands'] as const;

/** `YYYY-MM-DD`. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads query params into page state. Anything absent, blank or malformed falls
 * back to its default — today for the date, an empty selection for the filters —
 * so the page always has renderable state.
 */
export function parseSessionsUrl(params: Params): SessionsUrlState {
  return {
    date: parseDate(params[DATE_KEY]),
    venues: parseList(params, VENUE_KEYS),
    formats: parseList(params, FORMAT_KEYS),
    languages: parseList(params, LANGUAGE_KEYS),
    bands: parseList(params, BAND_KEYS),
  };
}

/**
 * Writes page state to query params.
 *
 * Empty selections become `null`, which `queryParamsHandling: 'merge'` removes
 * from the URL, and the default date is omitted so an untouched page keeps the
 * bare `/sessions` address.
 */
export function serializeSessionsUrl(state: SessionsUrlState): Params {
  return {
    [DATE_KEY]: state.date === todayIso() ? null : state.date,
    [VENUE_KEY]: joinList(state.venues),
    [FORMAT_KEY]: joinList(state.formats),
    [LANGUAGE_KEY]: joinList(state.languages),
    [BAND_KEY]: joinList(state.bands),
  };
}

/** First accepted key that carries a non-blank value. */
function firstValue(params: Params, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value: unknown = params[key];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

/**
 * Reads a comma-separated list (or a repeated parameter) into a trimmed,
 * de-duplicated array; missing values become an empty array.
 */
function parseList(params: Params, keys: readonly string[]): string[] {
  const value = firstValue(params, keys);
  const entries: unknown[] = Array.isArray(value) ? value : [value];

  const slugs = entries
    .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  return [...new Set(slugs)];
}

/** Valid local calendar day, or today when the value is missing or impossible. */
function parseDate(value: unknown): string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    return todayIso();
  }

  // Round-tripping rejects impossible days (e.g. `2026-02-31`), which `Date`
  // would otherwise silently roll over to the next month.
  return toIsoDate(new Date(`${value}T00:00:00`)) === value ? value : todayIso();
}

/** Comma-separated value, or `null` when nothing is selected (clears it on merge). */
function joinList(values: string[]): string | null {
  return values.length > 0 ? values.join(',') : null;
}

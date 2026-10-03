import { Params } from '@angular/router';
import { toIsoDate, todayIso } from '../session-date';

/**
 * Filter, date, sort, search and paging state of the Sessions page as it travels
 * in the URL.
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
  /** Sort id from `/filter-options`; falls back to the API default. */
  sort: string;
  /** Free-text film-title match; empty means "no search". */
  search: string;
  /** 1-based page, counting movies. Falls back to the first page. */
  page: number;
}

/** Sort applied by the API when the URL does not name one. */
export const DEFAULT_SORT = 'time_asc';

/** First page. */
export const FIRST_PAGE = 1;

/** Canonical key written for each field. */
const DATE_KEY = 'date';
const VENUE_KEY = 'venue';
const FORMAT_KEY = 'format';
const LANGUAGE_KEY = 'language';
const BAND_KEY = 'band';
const SORT_KEY = 'sort';
const SEARCH_KEY = 'search';
const PAGE_KEY = 'page';

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

/** A positive integer with no sign or padding, e.g. `1`, `12`. */
const POSITIVE_INT = /^[1-9]\d*$/;

/**
 * Reads query params into page state. Anything absent, blank or malformed falls
 * back to its default — today for the date, an empty selection for the filters,
 * the API default sort, no search and the first page — so the page always has
 * renderable state.
 */
export function parseSessionsUrl(params: Params): SessionsUrlState {
  return {
    date: parseDate(params[DATE_KEY]),
    venues: parseList(params, VENUE_KEYS),
    formats: parseList(params, FORMAT_KEYS),
    languages: parseList(params, LANGUAGE_KEYS),
    bands: parseList(params, BAND_KEYS),
    sort: parseSort(params[SORT_KEY]),
    search: parseSearch(params[SEARCH_KEY]),
    page: parsePage(params[PAGE_KEY]),
  };
}

/**
 * Writes page state to query params.
 *
 * Default values become `null`, which `queryParamsHandling: 'merge'` removes from
 * the URL, so an untouched page keeps the bare `/sessions` address and clearing a
 * filter genuinely clears its parameter.
 */
export function serializeSessionsUrl(state: SessionsUrlState): Params {
  return {
    [DATE_KEY]: state.date === todayIso() ? null : state.date,
    [VENUE_KEY]: joinList(state.venues),
    [FORMAT_KEY]: joinList(state.formats),
    [LANGUAGE_KEY]: joinList(state.languages),
    [BAND_KEY]: joinList(state.bands),
    [SORT_KEY]: state.sort === DEFAULT_SORT ? null : state.sort,
    [SEARCH_KEY]: state.search === '' ? null : state.search,
    [PAGE_KEY]: state.page === FIRST_PAGE ? null : state.page,
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

/** Trimmed sort id, or the API default when absent or blank. */
function parseSort(value: unknown): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : DEFAULT_SORT;
}

/**
 * Trimmed search text, or `''` when absent. Anything is accepted: the API owns
 * which titles match, so this only normalises whitespace.
 */
function parseSearch(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 1-based page, or the first page when absent or malformed. Only plain positive
 * integers are accepted, so `0`, `-1`, `1.5`, `1e3` and `01` all fall back rather
 * than reaching the API as a nonsense page.
 */
function parsePage(value: unknown): number {
  if (typeof value !== 'string' || !POSITIVE_INT.test(value)) {
    return FIRST_PAGE;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : FIRST_PAGE;
}

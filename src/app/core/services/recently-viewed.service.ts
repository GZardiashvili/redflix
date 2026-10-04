import { Service, signal } from '@angular/core';
import { Movie } from '../models/movie';

/**
 * Storage key of the recently viewed list. Browser-local UI history only —
 * no session data ever reaches this key.
 */
const STORAGE_KEY = 'redflix.recently-viewed';

/** Maximum number of entries kept, matching the six-card Home row. */
const LIMIT = 6;

/**
 * Snapshot of a movie that was opened from Home, search or the list itself.
 *
 * The Movie Details page does not exist yet, so the fields shown on the card
 * are copied at click time instead of being re-fetched later.
 */
export interface RecentlyViewedMovie {
  id: number;
  slug: string;
  title: string;
  posterUrl: string;
  rating: string;
  runtimeMinutes: number;
  /**
   * Genre names captured with the snapshot, so the card can show them without
   * re-fetching the movie. Empty for a movie the API sent no genres for.
   */
  genreNames: string[];
}

/**
 * Client-side "Recently Viewed" history: an ordered, de-duplicated signal list
 * persisted to `localStorage` and capped at {@link LIMIT}.
 *
 * Lives in core because both the Home page section and the header search record
 * into it. The list is plain UI state — every stored value is a non-sensitive
 * snapshot of public catalogue data.
 */
@Service()
export class RecentlyViewedService {
  private readonly itemsState = signal<RecentlyViewedMovie[]>(readStoredItems());

  /** Newest-first snapshots, at most {@link LIMIT}. */
  readonly items = this.itemsState.asReadonly();

  /** Records an opened movie: moves an existing entry to the front or prepends a fresh snapshot. */
  record(movie: Movie): void {
    this.insert({
      id: movie.id,
      slug: movie.slug,
      title: movie.title,
      posterUrl: movie.posterUrl,
      rating: movie.ageRating.code,
      runtimeMinutes: movie.runtimeMinutes,
      genreNames: movie.genres.map((genre) => genre.name),
    });
  }

  /** Re-opens an already stored snapshot: moves it to the front without re-snapshotting. */
  touch(item: RecentlyViewedMovie): void {
    this.insert(item);
  }

  private insert(item: RecentlyViewedMovie): void {
    const next = [item, ...this.itemsState().filter((existing) => existing.id !== item.id)].slice(
      0,
      LIMIT,
    );

    this.itemsState.set(next);
    storeItems(next);
  }
}

function readStoredItems(): RecentlyViewedMovie[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Ignore anything that does not carry the exact snapshot shape rather than
    // letting a corrupted entry break the Home page. Entries stored before the
    // card showed genres are kept and given an empty list, so a visitor does not
    // lose their history because this release added a field to the snapshot.
    return parsed
      .filter(isRecentlyViewedMovie)
      .map((item) => ({ ...item, genreNames: item.genreNames ?? [] }))
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

function storeItems(items: RecentlyViewedMovie[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage can be unavailable (private mode, quota): the in-memory list
    // still works for the current visit.
  }
}

function isRecentlyViewedMovie(value: unknown): value is RecentlyViewedMovie {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as RecentlyViewedMovie;
  return (
    typeof item.id === 'number' &&
    typeof item.slug === 'string' &&
    typeof item.title === 'string' &&
    typeof item.posterUrl === 'string' &&
    typeof item.rating === 'string' &&
    typeof item.runtimeMinutes === 'number' &&
    isGenreNames(item.genreNames)
  );
}

/** Optional on stored entries: only entries written before the field existed lack it. */
function isGenreNames(value: unknown): value is string[] | undefined {
  return (
    value === undefined || (Array.isArray(value) && value.every((name) => typeof name === 'string'))
  );
}

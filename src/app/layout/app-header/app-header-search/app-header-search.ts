import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { toApiError } from '../../../core/api/api-error';
import { Movie } from '../../../core/models/movie';
import { MoviesService } from '../../../core/services/movies.service';
import { RecentlyViewedService } from '../../../core/services/recently-viewed.service';
import { ErrorState } from '../../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../../shared/ui/loading/loading-indicator';

/** Debounce before a keystroke turns into a `/search` request. */
const SEARCH_DEBOUNCE_MS = 300;

/** Headline of the panel shown before the user has typed anything. */
const PROMPT_TITLE = 'What do you want to watch?';

/** Supporting line of the prompt panel. */
const PROMPT_MESSAGE = 'Search by title, director or cast';

/** Leading text of the no-results headline; the quoted query follows it. */
const NO_RESULTS_TITLE_PREFIX = 'No results for';

/** Supporting line of the no-results panel. */
const NO_RESULTS_MESSAGE = 'Check the spelling or try another film or live event.';

/** State of the dropdown; drives which panel branch renders. */
type SearchStatus = 'prompt' | 'loading' | 'results' | 'empty' | 'error';

/**
 * Header search typeahead: a 480px combobox whose panel switches between
 * prompt, loading, results, empty and error states.
 *
 * Search itself belongs to `MoviesService`; this component owns only the
 * interaction state (debounce, stale-response guard, keyboard selection and
 * outside-click dismissal). Opening a result records the Recently Viewed
 * snapshot and navigates to the movie's route.
 */
@Component({
  imports: [ErrorState, LoadingIndicator, RouterLink],
  selector: 'app-header-search',
  styleUrl: './app-header-search.scss',
  templateUrl: './app-header-search.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:focusin)': 'onDocumentFocusIn($event)',
    '(document:keydown.escape)': 'closePanel()',
  },
})
export class AppHeaderSearch {
  private readonly movies = inject(MoviesService);
  private readonly recentlyViewed = inject(RecentlyViewedService);
  private readonly router = inject(Router);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  /** Raw text in the input (kept separate from the trimmed request). */
  protected readonly query = signal('');

  /** Whether the panel is visible. */
  protected readonly open = signal(false);

  /** Current panel branch. */
  protected readonly status = signal<SearchStatus>('prompt');

  /** Matches of the last completed search (max 6, server-capped). */
  protected readonly results = signal<Movie[]>([]);

  /** Keyboard/highlight position inside the results list; `-1` means none. */
  protected readonly activeIndex = signal(-1);

  /** Message of the last failed search, rendered by the shared error state. */
  protected readonly errorMessage = signal('');

  /** Result count of the panel header, e.g. `3 results`. */
  protected readonly resultCountText = computed(() => {
    const count = this.results().length;
    return `${count} result${count === 1 ? '' : 's'}`;
  });

  /**
   * `id` of the highlighted option for `aria-activedescendant`; `null` while
   * nothing is highlighted so the attribute never dangles.
   */
  protected readonly activeDescendant = computed(() => {
    if (!this.open() || this.status() !== 'results') {
      return null;
    }

    const index = this.activeIndex();
    return index >= 0 && index < this.results().length ? `header-search-option-${index}` : null;
  });

  /** Panel copy, exposed for the template. */
  protected readonly promptTitle = PROMPT_TITLE;
  protected readonly promptMessage = PROMPT_MESSAGE;
  protected readonly noResultsMessage = NO_RESULTS_MESSAGE;

  /** `No results for “<query>”`, the Figma no-results headline. */
  protected readonly noResultsTitle = computed(
    () => `${NO_RESULTS_TITLE_PREFIX} “${this.query().trim()}”`,
  );

  /**
   * Monotonic request token: any state write coming back from an older query
   * is dropped, so a slow response can never overwrite a newer one.
   */
  private sequence = 0;

  private readonly queryChanges = new Subject<string>();

  constructor() {
    // Input events are debounced before they become requests; the subject
    // completes with the component, so no manual teardown is needed.
    this.queryChanges.pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed()).subscribe({
      next: (query) => this.runSearch(query),
      error: () => this.status.set('error'),
    });
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.activeIndex.set(-1);
    this.sequence += 1;

    const query = value.trim();

    if (query === '') {
      // Trim-before-empty: whitespace-only input shows the prompt panel and
      // never issues a request.
      this.results.set([]);
      this.errorMessage.set('');
      this.status.set('prompt');
      return;
    }

    this.status.set('loading');
    this.queryChanges.next(query);
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      if (event.key === 'Enter' && this.open() && this.status() === 'results') {
        const movie = this.results()[this.activeIndex()] ?? this.results()[0];

        if (movie) {
          event.preventDefault();
          this.openMovie(movie);
        }
      }

      return;
    }

    if (this.status() !== 'results' || this.results().length === 0) {
      return;
    }

    event.preventDefault();
    this.open.set(true);

    if (event.key === 'ArrowDown') {
      this.activeIndex.update((index) => Math.min(index + 1, this.results().length - 1));
    } else {
      this.activeIndex.update((index) => (index <= 0 ? -1 : index - 1));
    }
  }

  /** Navigates to the movie and records its Recently Viewed snapshot. */
  protected openMovie(movie: Movie): void {
    this.recentlyViewed.record(movie);
    this.closePanel();
    void this.router.navigate(['/movies', movie.slug]);
  }

  /** Clears the query back to the prompt panel without leaving a stale request. */
  protected clearQuery(): void {
    this.query.set('');
    this.results.set([]);
    this.activeIndex.set(-1);
    this.errorMessage.set('');
    this.sequence += 1;
    this.status.set('prompt');

    this.inputRef()?.nativeElement.focus();
  }

  /** `film` → `Film` for the result row meta line. */
  protected kindLabel(kind: string): string {
    const label = kind.replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  /** Re-runs the current query after a failure. */
  protected retrySearch(): void {
    const query = this.query().trim();

    if (query === '') {
      return;
    }

    this.status.set('loading');
    this.runSearch(query);
  }

  protected closePanel(): void {
    this.open.set(false);
  }

  /** Closes the panel when a click lands outside the search widget. */
  protected onDocumentClick(event: Event): void {
    const target = event.target;

    if (target instanceof Node && !this.hostRef.nativeElement.contains(target)) {
      this.closePanel();
    }
  }

  /** Also closes it when focus moves outside, e.g. with the Tab key. */
  protected onDocumentFocusIn(event: Event): void {
    const target = event.target;

    if (target instanceof Node && !this.hostRef.nativeElement.contains(target)) {
      this.closePanel();
    }
  }

  private async runSearch(query: string): Promise<void> {
    const sequence = this.sequence;

    try {
      const movies = await this.movies.search(query);

      if (sequence !== this.sequence) {
        return;
      }

      this.results.set(movies);
      this.errorMessage.set('');
      this.status.set(movies.length > 0 ? 'results' : 'empty');
    } catch (error) {
      if (sequence !== this.sequence) {
        return;
      }

      this.results.set([]);
      this.errorMessage.set(toApiError(error).body?.message ?? 'Search is unavailable right now.');
      this.status.set('error');
    }
  }
}

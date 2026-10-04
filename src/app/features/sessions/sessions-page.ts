import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { SortOption } from '../../core/models/filter-options';
import { Movie } from '../../core/models/movie';
import {
  MovieSession,
  MovieSessionGroup,
  SessionsMeta,
  SessionsQuery,
  SessionTimeBand,
} from '../../core/models/session';
import { AuthService } from '../../core/services/auth.service';
import { FilterOptionsService } from '../../core/services/filter-options.service';
import { SessionsService } from '../../core/services/sessions.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { BookingEntryService } from '../booking/booking-entry.service';
import { ageEligibility, restrictionMessage } from '../../shared/utils/screening-eligibility';
import { DateSelector } from './components/date-selector/date-selector';
import { SessionMovieCard } from './components/session-movie-card/session-movie-card';
import { SessionsPagination } from './components/sessions-pagination/sessions-pagination';
import {
  SessionsFilters,
  SessionsFiltersValue,
} from './components/sessions-filters/sessions-filters';
import { SessionsTopBar } from './components/sessions-top-bar/sessions-top-bar';
import {
  FIRST_PAGE,
  parseSessionsUrl,
  serializeSessionsUrl,
  SessionsUrlState,
} from './utils/sessions-url.utils';

/** Sort list used only before `/filter-options` has resolved. */
const EMPTY_SORT_OPTIONS: SortOption[] = [];

/**
 * Sessions page: sticky filter sidebar (date picker + filter groups) plus the
 * showtimes list grouped by movie.
 *
 * The query parameters are the single source of truth for the date, filters, sort,
 * search and page: the page reads them on init, mirrors them into the child
 * components and refetches, and writes every user action back to the URL. Because
 * that round-trip is idempotent, Back/Forward restores a previous view without the
 * children re-emitting.
 *
 * The toolbar's search field is gone — the header typeahead owns film search — so
 * `search` is now written only by the URL. A `/sessions?q=…` link still narrows
 * the list, which is what the typeahead's "browse" links rely on.
 */
@Component({
  imports: [
    DateSelector,
    EmptyState,
    ErrorState,
    SessionMovieCard,
    SessionsFilters,
    SessionsPagination,
    SessionsTopBar,
    Skeleton,
  ],
  selector: 'app-sessions-page',
  styleUrl: './sessions-page.scss',
  templateUrl: './sessions-page.html',
})
export class SessionsPage {
  private readonly sessions = inject(SessionsService);
  private readonly filterOptions = inject(FilterOptionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingEntryService);

  /** URL state at construction, so the very first render already matches the address bar. */
  private readonly initialState = parseSessionsUrl(this.route.snapshot.queryParams);

  /** Calendar day driving the request; mirrored from the URL. */
  protected readonly selectedDate = signal(this.initialState.date);

  /** Sidebar selection; mirrored from the URL and owned by this page. */
  protected readonly filters = signal<SessionsFiltersValue>(toFiltersValue(this.initialState));

  /** Sort id; mirrored from the URL, defaulting to the API's own default. */
  protected readonly sort = signal(this.initialState.sort);

  /** Film-title search; mirrored from the URL, which is now its only writer. */
  private readonly search = signal(this.initialState.search);

  /** Requested page; mirrored from the URL. */
  protected readonly page = signal(this.initialState.page);

  /** Sort options owned by `/filter-options`, for the toolbar dropdown. */
  protected readonly sortOptions = computed(
    () => this.filterOptions.value()?.sorts ?? EMPTY_SORT_OPTIONS,
  );

  /** Movie groups of the current page, as grouped by the API. */
  protected readonly groups = signal<MovieSessionGroup[]>([]);

  /** Pagination/date metadata of the last response; `null` before the first load. */
  protected readonly meta = signal<SessionsMeta | null>(null);

  /** Whether a (re)load is still running. */
  protected readonly loading = signal(true);

  /** Failure message of the last load, `null` while healthy. */
  protected readonly error = signal<string | null>(null);

  /**
   * Page the API actually returned. It clamps `meta.currentPage`, so a stale URL
   * pointing past the end (e.g. `?page=99`) still highlights a real page.
   */
  protected readonly resolvedPage = computed(() => {
    const meta = this.meta();
    return meta ? meta.currentPage : this.page();
  });

  /** Last page the API reports for the current filters. */
  protected readonly resolvedLastPage = computed(() => this.meta()?.lastPage ?? 1);

  /**
   * Total sessions from `meta.totalSessions` — the API's own count. The page must
   * not use the length of `groups()`: that array holds one entry per *movie*, so it
   * would under-report whenever a movie has several showtimes.
   */
  protected readonly totalSessionCount = computed(() => this.meta()?.totalSessions ?? 0);

  /** Placeholder groups / pills of the loading skeleton. */
  protected readonly skeletonGroups = [0, 1, 2];
  protected readonly skeletonPills = [0, 1, 2, 3];

  constructor() {
    // `queryParams` replays its current value on subscribe, so this performs the
    // initial load and then reacts to every later change — a filter, date, sort or
    // page change, as well as a Back/Forward navigation.
    this.route.queryParams
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.applyUrlState(params));
  }

  /** Fetches the showtimes for the current date and filter selection. */
  protected loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);

    firstValueFrom(this.sessions.getSessions(this.buildQuery())).then(
      (response) => {
        this.groups.set(response.data);
        this.meta.set(response.meta);
        this.loading.set(false);
      },
      (error: unknown) => {
        this.groups.set([]);
        this.meta.set(null);
        this.error.set(
          toApiError(error).body?.message ?? 'Could not load sessions. Please try again.',
        );
        this.loading.set(false);
      },
    );
  }

  /** A day was picked in the sidebar; reflect it and push it to the URL. */
  protected onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.navigate({ ...this.currentState(), date, page: FIRST_PAGE });
  }

  /** A filter checkbox changed; reflect it and push it to the URL. */
  protected onFiltersChange(filters: SessionsFiltersValue): void {
    this.filters.set(filters);
    this.navigate({ ...this.currentState(), ...filters, page: FIRST_PAGE });
  }

  /** A sort was chosen in the toolbar; applied like any other filter. */
  protected onSortChange(sort: string): void {
    this.navigate({ ...this.currentState(), sort, page: FIRST_PAGE });
  }

  /** A page was requested. This is the one change that keeps the current page. */
  protected onPageChange(page: number): void {
    this.navigate({ ...this.currentState(), page });
  }

  /**
   * Whether a chosen screening is waiting on the account's profile being
   * completed. The booking dialog stays closed in that case, so the page says so
   * rather than letting the click look like it did nothing.
   */
  protected readonly bookingBlockedByProfile = this.booking.blockedByProfile;

  /**
   * Whether this movie's screenings are blocked by the account's age.
   *
   * A guest is never blocked — the age check belongs after login — so a guest
   * clicking an 18+ pill goes through the login flow and is checked again once
   * the account is known. An authenticated account the server can give no age
   * for counts as blocked, so missing data cannot slip past the rating.
   */
  protected isAgeRestricted(movie: Movie): boolean {
    return ageEligibility(this.auth.user(), movie.ageRating.minAge) !== 'eligible';
  }

  /** The restriction copy for this movie's blocked pills. */
  protected restrictionCopy(movie: Movie): string {
    return restrictionMessage(movie.ageRating.code);
  }

  /** A session pill was clicked; the movie it belongs to comes with it. */
  protected onSelectSession(picked: { movie: Movie; session: MovieSession }): void {
    // Last line of defence. The pill already disables itself for both cases, so
    // this only guards against a future caller starting a booking from an
    // ineligible screening — it never blocks an eligible one.
    if (picked.session.isSoldOut || this.isAgeRestricted(picked.movie)) {
      return;
    }

    this.booking.select(picked.session, {
      slug: picked.movie.slug,
      title: picked.movie.title,
      ageRating: picked.movie.ageRating,
    });
  }

  /** The URL state the page is currently showing. */
  private currentState(): SessionsUrlState {
    return {
      ...this.filters(),
      date: this.selectedDate(),
      sort: this.sort(),
      search: this.search(),
      page: this.page(),
    };
  }

  /** Mirrors URL params into the signals the children render, then refetches. */
  private applyUrlState(params: Params): void {
    const state = parseSessionsUrl(params);

    this.selectedDate.set(state.date);
    this.filters.set(toFiltersValue(state));
    this.sort.set(state.sort);
    this.search.set(state.search);
    this.page.set(state.page);
    this.loadSessions();
  }

  /**
   * Writes state to the URL. `merge` keeps any parameter this task does not own
   * intact, and leaving `replaceUrl` at its default records a history entry, so
   * Back steps through the user's changes.
   */
  private navigate(state: SessionsUrlState): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeSessionsUrl(state),
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Request for the date, filters, sort, search and page currently in the URL.
   * They are assembled in one place so every request reflects a single consistent
   * state.
   */
  private buildQuery(): SessionsQuery {
    const state = this.currentState();

    return {
      date: state.date,
      venues: state.venues,
      formats: state.formats,
      languages: state.languages,
      // Band slugs come from `/filter-options`, whose ids are the API's own time
      // bands, so the values are already `SessionTimeBand`s.
      bands: state.bands as SessionTimeBand[],
      sort: state.sort,
      search: state.search,
      page: state.page,
    };
  }
}

/** The four filter arrays of a URL state, without the date. */
function toFiltersValue(state: SessionsUrlState): SessionsFiltersValue {
  return {
    venues: state.venues,
    formats: state.formats,
    languages: state.languages,
    bands: state.bands,
  };
}

import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import {
  MovieSession,
  MovieSessionGroup,
  SessionsMeta,
  SessionsQuery,
  SessionTimeBand,
} from '../../core/models/session';
import { SessionsService } from '../../core/services/sessions.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { DateSelector } from './components/date-selector/date-selector';
import { SessionMovieCard } from './components/session-movie-card/session-movie-card';
import {
  SessionsFilters,
  SessionsFiltersValue,
} from './components/sessions-filters/sessions-filters';
import {
  parseSessionsUrl,
  serializeSessionsUrl,
  SessionsUrlState,
} from './utils/sessions-url.utils';

/**
 * Sessions page: sticky filter sidebar (date picker + filter groups) plus the
 * showtimes list grouped by movie.
 *
 * The query parameters are the single source of truth for the date and filter
 * selection: the page reads them on init, mirrors them into the child components
 * and refetches, and writes every user action back to the URL. Because that
 * round-trip is idempotent, Back/Forward restores a previous view without the
 * children re-emitting. Only filters and date are synchronized here; sorting,
 * search and paging belong to the follow-up task.
 */
@Component({
  imports: [DateSelector, EmptyState, ErrorState, SessionMovieCard, SessionsFilters, Skeleton],
  selector: 'app-sessions-page',
  styleUrl: './sessions-page.scss',
  templateUrl: './sessions-page.html',
})
export class SessionsPage {
  private readonly sessions = inject(SessionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** URL state at construction, so the very first render already matches the address bar. */
  private readonly initialState = parseSessionsUrl(this.route.snapshot.queryParams);

  /** Calendar day driving the request; mirrored from the URL. */
  protected readonly selectedDate = signal(this.initialState.date);

  /** Sidebar selection; mirrored from the URL and owned by this page. */
  protected readonly filters = signal<SessionsFiltersValue>(toFiltersValue(this.initialState));

  /** Movie groups of the current page, as grouped by the API. */
  protected readonly groups = signal<MovieSessionGroup[]>([]);

  /** Pagination/date metadata of the last response; `null` before the first load. */
  protected readonly meta = signal<SessionsMeta | null>(null);

  /** Whether a (re)load is still running. */
  protected readonly loading = signal(true);

  /** Failure message of the last load, `null` while healthy. */
  protected readonly error = signal<string | null>(null);

  /** Summary line above the list, e.g. `Showing 68 sessions`. */
  protected readonly summary = computed(() => {
    const total = this.meta()?.totalSessions ?? 0;
    return `Showing ${total} ${total === 1 ? 'session' : 'sessions'}`;
  });

  /** Placeholder groups / pills of the loading skeleton. */
  protected readonly skeletonGroups = [0, 1, 2];
  protected readonly skeletonPills = [0, 1, 2, 3];

  constructor() {
    // `queryParams` replays its current value on subscribe, so this performs the
    // initial load and then reacts to every later change — a filter or date click
    // as well as a Back/Forward navigation.
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
    this.navigate({ date, ...this.filters() });
  }

  /** A filter checkbox changed; reflect it and push it to the URL. */
  protected onFiltersChange(filters: SessionsFiltersValue): void {
    this.filters.set(filters);
    this.navigate({ date: this.selectedDate(), ...filters });
  }

  /**
   * A session pill was clicked. Seat selection and the booking modal belong to
   * a later task, so this handler is intentionally a stub for now.
   */
  protected onSelectSession(_session: MovieSession): void {
    // Intentionally empty until the booking flow lands.
  }

  /** Mirrors URL params into the signals the children render, then refetches. */
  private applyUrlState(params: Params): void {
    const state = parseSessionsUrl(params);

    this.selectedDate.set(state.date);
    this.filters.set(toFiltersValue(state));
    this.loadSessions();
  }

  /**
   * Writes state to the URL. `merge` keeps parameters this task does not own
   * (sort/search/page) intact, and leaving `replaceUrl` at its default records a
   * history entry, so Back steps through the user's filter changes.
   */
  private navigate(state: SessionsUrlState): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: serializeSessionsUrl(state),
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Request for the current date and sidebar selection. Date and filters live
   * together here so every request reflects one consistent state; sorting and
   * paging will join them in the follow-up task.
   */
  private buildQuery(): SessionsQuery {
    const filters = this.filters();

    return {
      date: this.selectedDate(),
      venues: filters.venues,
      formats: filters.formats,
      languages: filters.languages,
      // Band slugs come from `/filter-options`, whose ids are the API's own time
      // bands, so the values are already `SessionTimeBand`s.
      bands: filters.bands as SessionTimeBand[],
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

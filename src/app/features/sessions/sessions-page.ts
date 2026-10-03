import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
  NO_SESSIONS_FILTERS,
  SessionsFilters,
  SessionsFiltersValue,
} from './components/sessions-filters/sessions-filters';
import { todayIso } from './session-date';

/**
 * Sessions page: sticky filter sidebar (date picker + filter groups) plus the
 * showtimes list grouped by movie.
 *
 * The page owns the request state — the selected day and the sidebar selection —
 * so the filters component stays presentational and never calls the API. URL
 * query-param sync and pagination/sorting arrive with the follow-up tasks.
 */
@Component({
  imports: [DateSelector, EmptyState, ErrorState, SessionMovieCard, SessionsFilters, Skeleton],
  selector: 'app-sessions-page',
  styleUrl: './sessions-page.scss',
  templateUrl: './sessions-page.html',
})
export class SessionsPage implements OnInit {
  private readonly sessions = inject(SessionsService);

  /** Calendar day driving the request: local `YYYY-MM-DD`, starting on today. */
  protected readonly selectedDate = signal(todayIso());

  /** Sidebar selection, kept in sync through the filter component's output. */
  protected readonly filters = signal<SessionsFiltersValue>(NO_SESSIONS_FILTERS);

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

  ngOnInit(): void {
    this.loadSessions();
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

  /** A day was picked in the sidebar; reload for it. */
  protected onDateChange(date: string): void {
    this.selectedDate.set(date);
    this.loadSessions();
  }

  /** A filter checkbox changed; reload with the new selection. */
  protected onFiltersChange(filters: SessionsFiltersValue): void {
    this.filters.set(filters);
    this.loadSessions();
  }

  /**
   * A session pill was clicked. Seat selection and the booking modal belong to
   * a later task, so this handler is intentionally a stub for now.
   */
  protected onSelectSession(_session: MovieSession): void {
    // Intentionally empty until the booking flow lands.
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

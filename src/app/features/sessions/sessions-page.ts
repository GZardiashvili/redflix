import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { MovieSession, MovieSessionGroup, SessionsMeta } from '../../core/models/session';
import { SessionsService } from '../../core/services/sessions.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { SessionMovieCard } from './components/session-movie-card/session-movie-card';

/**
 * Sessions page: sticky filter sidebar (a clean slot until Task 11 lands) plus
 * the showtimes list grouped by movie.
 *
 * This task always loads today's sessions; date switching, URL query-param
 * sync, sidebar filters and pagination arrive with the follow-up tasks.
 */
@Component({
  imports: [EmptyState, ErrorState, SessionMovieCard, Skeleton],
  selector: 'app-sessions-page',
  styleUrl: './sessions-page.scss',
  templateUrl: './sessions-page.html',
})
export class SessionsPage implements OnInit {
  private readonly sessions = inject(SessionsService);

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

  /** Fetches today's showtimes; the server defaults and stamps `meta.date`. */
  protected loadSessions(): void {
    this.loading.set(true);
    this.error.set(null);

    firstValueFrom(this.sessions.getSessions({ date: todayIso() })).then(
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

  /**
   * A session pill was clicked. Seat selection and the booking modal belong to
   * a later task, so this handler is intentionally a stub for now.
   */
  protected onSelectSession(_session: MovieSession): void {
    // Intentionally empty until the booking flow lands.
  }
}

/** Local `YYYY-MM-DD` for today; avoids the UTC shift of `toISOString()`. */
function todayIso(): string {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { Movie } from '../../core/models/movie';
import {
  AuthReplayService,
  isAuthReplayCancellation,
} from '../../core/services/auth-replay.service';
import { AuthService } from '../../core/services/auth.service';
import { MoviesService } from '../../core/services/movies.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../shared/ui/loading/loading-indicator';
import { ComingSoonCard } from './components/coming-soon-card/coming-soon-card';
import { HomeHero } from './components/home-hero/home-hero';
import { MovieCard } from './components/movie-card/movie-card';
import { RecentlyViewedCard } from './components/recently-viewed-card/recently-viewed-card';

@Component({
  imports: [
    ComingSoonCard,
    EmptyState,
    ErrorState,
    HomeHero,
    LoadingIndicator,
    MovieCard,
    RecentlyViewedCard,
    RouterLink,
  ],
  selector: 'app-home-page',
  styleUrl: './home-page.scss',
  templateUrl: './home-page.html',
})
export class HomePage implements OnInit {
  private readonly movies = inject(MoviesService);
  private readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);

  protected readonly recentlyViewed = inject(RecentlyViewedService);

  protected readonly featured = signal<HomeSection<Movie[]>>(pendingSection());
  protected readonly nowPlaying = signal<HomeSection<Movie[]>>(pendingSection());
  protected readonly comingSoon = signal<HomeSection<Movie[]>>(pendingSection());

  /**
   * Whether the Coming Soon row shows the full unreleased catalogue.
   *
   * The row starts as a capped teaser (`limit`), and "See all" swaps it for the
   * complete list in place. It deliberately does **not** navigate: `GET /sessions`
   * only carries released movies, so an unreleased title has no showtime to open
   * — the session grid would show the same films as Now Playing and silently omit
   * every card the visitor just clicked on.
   */
  protected readonly comingSoonExpanded = signal(false);

  /** Per-movie notify flow state, keyed by movie id. */
  private readonly notifyStates = signal<Record<number, NotifyState>>({});

  /** Server-confirmed subscriptions, keyed by movie id; `movie.isNotified` until then. */
  private readonly notifySubscriptions = signal<Record<number, boolean>>({});

  ngOnInit(): void {
    this.loadFeatured();
    this.loadNowPlaying();
    this.loadComingSoon();
  }

  protected loadFeatured(): void {
    this.featured.set(pendingSection());

    this.movies.getFeatured().then(
      (data) => this.featured.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.featured.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }

  protected loadNowPlaying(): void {
    this.nowPlaying.set(pendingSection());

    this.movies.getNowPlaying(NOW_PLAYING_LIMIT).then(
      (data) => this.nowPlaying.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.nowPlaying.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }

  protected loadComingSoon(): void {
    // The capped teaser on first paint; the retry control re-runs the same state
    // the visitor is looking at rather than snapping back to the teaser.
    this.loadComingSoonMovies(this.comingSoonExpanded() ? undefined : COMING_SOON_LIMIT);
  }

  /**
   * "See all" on Coming Soon: expands the row to the full catalogue in place.
   *
   * Two requests, no navigation. Expanded sends **no** `limit` — the documented
   * way to ask for every unreleased title — and collapses back to the capped
   * teaser. Now Playing keeps its own link to `/sessions`, which is the correct
   * destination for released films.
   */
  protected toggleComingSoon(): void {
    const expanded = !this.comingSoonExpanded();
    this.comingSoonExpanded.set(expanded);

    this.loadComingSoonMovies(expanded ? undefined : COMING_SOON_LIMIT);
  }

  /** Label of the Coming Soon toggle, describing what the click will do. */
  protected get comingSoonToggleLabel(): string {
    return this.comingSoonExpanded() ? 'Show less' : 'See all';
  }

  private loadComingSoonMovies(limit: number | undefined): void {
    this.comingSoon.set(pendingSection());

    this.movies.getComingSoon(limit).then(
      (data) => this.comingSoon.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.comingSoon.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }

  /** Current notify flow state of a movie (idle until the first interaction). */
  protected notifyState(movie: Movie): NotifyState {
    return this.notifyStates()[movie.id] ?? IDLE_NOTIFY;
  }

  /**
   * Whether the card shows the subscribed state: the last server response when
   * we have one, otherwise the value the catalogue returned.
   */
  protected isNotified(movie: Movie): boolean {
    return this.notifySubscriptions()[movie.id] ?? movie.isNotified;
  }

  /**
   * Notify Me flow: a guest first passes through the single login recovery flow
   * (the request then replays through the auth interceptor), the subscription
   * itself is `POST /movies/{movie}/notify`, and failures surface the server's
   * own message. A dismissed login cancels silently.
   */
  protected async requestNotify(movie: Movie): Promise<void> {
    if (this.notifyState(movie).pending || this.isNotified(movie)) {
      return;
    }

    this.patchNotify(movie.id, { pending: true, error: null });

    try {
      if (!this.auth.isAuthenticated()) {
        await firstValueFrom(this.replay.waitForLogin());
      }

      const result = await this.movies.notifyMovie(movie.slug);
      this.notifySubscriptions.update((all) => ({ ...all, [movie.id]: result.subscribed }));
      this.patchNotify(movie.id, { pending: false, error: null });
    } catch (error) {
      if (isAuthReplayCancellation(error)) {
        // The login was dismissed without authenticating: return to idle.
        this.patchNotify(movie.id, { pending: false, error: null });
        return;
      }

      this.patchNotify(movie.id, {
        pending: false,
        error: toApiError(error).body?.message ?? 'Could not subscribe to notifications.',
      });
    }
  }

  private patchNotify(movieId: number, patch: Partial<NotifyState>): void {
    this.notifyStates.update((all) => ({
      ...all,
      [movieId]: { ...IDLE_NOTIFY, ...all[movieId], ...patch },
    }));
  }
}

/** Loading/success/empty/error state of one independently loaded Home section. */
interface HomeSection<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

/** Pending flag and failure message of one movie's notify flow. */
interface NotifyState {
  pending: boolean;
  error: string | null;
}

const IDLE_NOTIFY: NotifyState = { pending: false, error: null };

const NOW_PLAYING_LIMIT = 6;
const COMING_SOON_LIMIT = 4;

function pendingSection<T>(): HomeSection<T> {
  return { loading: true, data: null, error: null };
}

/**
 * Verbatim server message when the API supplied one, neutral fallback
 * otherwise. Never throws: section state must always be representable.
 */
function sectionError(error: unknown): string {
  return toApiError(error).body?.message ?? 'Could not load movies. Please try again.';
}

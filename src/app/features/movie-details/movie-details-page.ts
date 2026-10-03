import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { MovieDetail } from '../../core/models/movie';
import { MoviesService } from '../../core/services/movies.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { MovieDetailsPanel } from './components/movie-details-panel/movie-details-panel';
import { MovieHero } from './components/movie-hero/movie-hero';
import { formatReleaseDate } from './movie-release-date';

/**
 * Movie Details page at `/movies/:slug`, showing one title's backdrop, poster and
 * every detail field the API supplies.
 *
 * The slug comes from the route, so the page works when opened directly or
 * refreshed. It listens to `ActivatedRoute.paramMap` rather than reading the
 * snapshot once, so navigating between two movies — or using Back/Forward —
 * reloads the new slug and clears the previous result instead of leaving stale
 * content on screen.
 *
 * Showtimes, venues and screening buttons are Task 15's scope and are absent here;
 * this task renders the movie itself only.
 */
@Component({
  imports: [EmptyState, ErrorState, MovieDetailsPanel, MovieHero, RouterLink, Skeleton],
  selector: 'app-movie-details-page',
  styleUrl: './movie-details-page.scss',
  templateUrl: './movie-details-page.html',
})
export class MovieDetailsPage {
  private readonly movies = inject(MoviesService);
  private readonly route = inject(ActivatedRoute);

  /** The loaded movie, or `null` while loading or after a failure. */
  protected readonly movie = signal<MovieDetail | null>(null);

  /** Whether a request is in flight. */
  protected readonly loading = signal(true);

  /**
   * Failure message for a non-404 request, `null` otherwise. A missing movie is
   * tracked separately because the design calls for a not-found state rather than
   * a generic error.
   */
  protected readonly error = signal<string | null>(null);

  /** Whether the API reported no movie for this slug. */
  protected readonly notFound = signal(false);

  /**
   * Monotonic request token. A response from a slug the user has already left is
   * discarded, so a slow request cannot overwrite the movie now on screen.
   */
  private sequence = 0;

  /** `releaseDate` in the design's `4 September 2026` shape, `''` when unusable. */
  protected readonly releaseDate = computed(() => formatReleaseDate(this.movie()?.releaseDate));

  /** `NOW PLAYING` / `COMING SOON`, taken from the API's own flag. */
  protected readonly statusLabel = computed(() =>
    this.movie()?.isComingSoon ? 'COMING SOON' : 'NOW PLAYING',
  );

  constructor() {
    // `paramMap` replays the current slug on subscribe, so this performs the
    // initial load as well as every later slug change.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const slug = params.get('slug');

      if (slug !== null && slug !== '') {
        this.loadMovie(slug);
      }
    });
  }

  /** Loads one movie by slug, showing the page's loading state meanwhile. */
  protected loadMovie(slug: string): void {
    this.sequence += 1;
    const request = this.sequence;

    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    // Cleared up front: the previous movie must never sit under the new slug.
    this.movie.set(null);

    this.movies.getMovie(slug).then(
      (movie) => {
        if (request !== this.sequence) {
          return;
        }

        this.movie.set(movie);
        this.loading.set(false);
      },
      (failure: unknown) => {
        if (request !== this.sequence) {
          return;
        }

        const apiError = toApiError(failure);

        this.notFound.set(apiError.status === 404);
        this.error.set(apiError.body?.message ?? 'Could not load this movie. Please try again.');
        this.loading.set(false);
      },
    );
  }

  /** Retry re-requests the slug currently shown in the address bar. */
  protected retry(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug !== null && slug !== '') {
      this.loadMovie(slug);
    }
  }
}

import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie, formatGenres } from '../../../../core/models/movie';
import { RecentlyViewedService } from '../../../../core/services/recently-viewed.service';
import { RatingBadge } from '../../../../shared/ui/rating-badge/rating-badge';

/**
 * Now Playing card: poster, title, genres, runtime, age rating and starting
 * price with a `Buy ticket` action into the Movie Details route.
 *
 * Purely presentational apart from snapshotting the opened movie into
 * Recently Viewed: the Home page owns loading and data.
 */
@Component({
  imports: [RatingBadge, RouterLink],
  selector: 'app-movie-card',
  styleUrl: './movie-card.scss',
  templateUrl: './movie-card.html',
})
export class MovieCard {
  /** Movie summary rendered by this card. */
  readonly movie = input.required<Movie>();

  /** Genre names for the meta row; `''` when the movie has none. */
  protected readonly genreLabel = computed(() => formatGenres(this.movie().genres));

  private readonly recentlyViewed = inject(RecentlyViewedService);

  /** Opening the movie records the snapshot at click time. */
  protected recordView(): void {
    this.recentlyViewed.record(this.movie());
  }
}

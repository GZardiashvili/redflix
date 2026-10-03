import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../../../core/models/movie';
import { RecentlyViewedService } from '../../../../core/services/recently-viewed.service';

/**
 * Now Playing card: poster, title, age rating, runtime and starting price
 * with a `Buy Ticket` action into the Movie Details route.
 *
 * Purely presentational apart from snapshotting the opened movie into
 * Recently Viewed: the Home page owns loading and data.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-movie-card',
  styleUrl: './movie-card.scss',
  templateUrl: './movie-card.html',
})
export class MovieCard {
  /** Movie summary rendered by this card. */
  readonly movie = input.required<Movie>();

  private readonly recentlyViewed = inject(RecentlyViewedService);

  /** Opening the movie records the snapshot at click time. */
  protected recordView(): void {
    this.recentlyViewed.record(this.movie());
  }
}

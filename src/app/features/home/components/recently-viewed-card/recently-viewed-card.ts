import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  RecentlyViewedService,
  RecentlyViewedMovie,
} from '../../../../core/services/recently-viewed.service';
import { RatingBadge } from '../../../../shared/ui/rating-badge/rating-badge';

/**
 * Compact Recently Viewed entry: cropped poster, title, genres and rating.
 *
 * The data is a snapshot taken when the movie was last opened, so no request
 * runs here. Opening the card moves it back to the front of the list.
 */
@Component({
  imports: [RatingBadge, RouterLink],
  selector: 'app-recently-viewed-card',
  styleUrl: './recently-viewed-card.scss',
  templateUrl: './recently-viewed-card.html',
})
export class RecentlyViewedCard {
  /** Snapshotted movie summary. */
  readonly movie = input.required<RecentlyViewedMovie>();

  /** Snapshotted genre names for the meta row; `''` when none were captured. */
  protected readonly genreLabel = computed(() => this.movie().genreNames.join(', '));

  private readonly recentlyViewed = inject(RecentlyViewedService);

  /** Re-opening an entry promotes it to the front of the list. */
  protected touch(): void {
    this.recentlyViewed.touch(this.movie());
  }
}

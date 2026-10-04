import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Movie, primaryGenre } from '../../../../core/models/movie';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { RatingBadge } from '../../../../shared/ui/rating-badge/rating-badge';

/**
 * Coming Soon card: the Figma `Card_medium` row — a wide backdrop beside a
 * content column that leads with the release date, then the title, the single
 * genre with the runtime, the age rating and a `Notify Me` action.
 *
 * The card is presentational: the parent owns the subscribe flow (guest login,
 * replay and server state) and passes the current `notifyPending`,
 * `notifySubscribed` and `notifyError` snapshot down.
 */
@Component({
  imports: [DatePipe, LoadingIndicator, RatingBadge],
  selector: 'app-coming-soon-card',
  styleUrl: './coming-soon-card.scss',
  templateUrl: './coming-soon-card.html',
})
export class ComingSoonCard {
  /** Movie summary rendered by this card. */
  readonly movie = input.required<Movie>();

  /**
   * The single genre shown beside the runtime.
   *
   * The Figma card has room for one category, so this is the API's own first
   * genre — the same choice `primaryGenre` makes for every other card, and `''`
   * when the movie has none, which drops the separator with it.
   */
  protected readonly genreLabel = computed(() => primaryGenre(this.movie().genres));

  /** Whether a notify request (or its login gate) is currently running. */
  readonly notifyPending = input(false);

  /** Whether the user is already subscribed; parent-owned server truth. */
  readonly notifySubscribed = input(false);

  /** Failure message of the last notify attempt, or `null`. */
  readonly notifyError = input<string | null>(null);

  /** The user asked to be notified; the parent runs the subscribe flow. */
  readonly notifyRequested = output<Movie>();
}

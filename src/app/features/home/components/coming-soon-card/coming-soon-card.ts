import { Component, input, output } from '@angular/core';
import { Movie } from '../../../../core/models/movie';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';

/**
 * Coming Soon card: poster, title, age rating, runtime and release date with
 * a `Notify Me` action.
 *
 * The card is presentational: the parent owns the subscribe flow (guest login,
 * replay and server state) and passes the current `notifyPending`,
 * `notifySubscribed` and `notifyError` snapshot down.
 */
@Component({
  imports: [LoadingIndicator],
  selector: 'app-coming-soon-card',
  styleUrl: './coming-soon-card.scss',
  templateUrl: './coming-soon-card.html',
})
export class ComingSoonCard {
  /** Movie summary rendered by this card. */
  readonly movie = input.required<Movie>();

  /** Whether a notify request (or its login gate) is currently running. */
  readonly notifyPending = input(false);

  /** Whether the user is already subscribed; parent-owned server truth. */
  readonly notifySubscribed = input(false);

  /** Failure message of the last notify attempt, or `null`. */
  readonly notifyError = input<string | null>(null);

  /** The user asked to be notified; the parent runs the subscribe flow. */
  readonly notifyRequested = output<Movie>();
}

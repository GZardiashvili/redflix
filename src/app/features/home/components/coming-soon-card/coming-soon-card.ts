import { Component, input, output } from '@angular/core';
import { Movie } from '../../../../core/models/movie';

/**
 * Coming Soon card: poster, title, age rating, runtime and release date with
 * a `Notify Me` action.
 *
 * The button only reports the intent: the notification API call and its
 * authentication flow belong to Task 09.
 */
@Component({
  imports: [],
  selector: 'app-coming-soon-card',
  styleUrl: './coming-soon-card.scss',
  templateUrl: './coming-soon-card.html',
})
export class ComingSoonCard {
  /** Movie summary rendered by this card. */
  readonly movie = input.required<Movie>();

  /** The user asked to be notified; handled by the Task 09 interaction layer. */
  readonly notifyRequested = output<Movie>();
}

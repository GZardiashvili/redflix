import { Component, input, output } from '@angular/core';
import { MovieSession, MovieSessionGroup } from '../../../../core/models/session';
import { SessionTimePill } from '../session-time-pill/session-time-pill';

/**
 * One movie's block in the showtimes list: poster, title, age-rating badge,
 * runtime + formats, and the horizontally scrolling row of its session pills.
 *
 * Presentational: pill clicks are re-emitted as `select`, so the page stays the
 * owner of the booking flow.
 */
@Component({
  imports: [SessionTimePill],
  selector: 'app-session-movie-card',
  styleUrl: './session-movie-card.scss',
  templateUrl: './session-movie-card.html',
})
export class SessionMovieCard {
  /** Movie + sessions group rendered by this card. */
  readonly group = input.required<MovieSessionGroup>();

  /** A session pill was clicked. */
  readonly select = output<MovieSession>();

  /** `PANORAMA · MOTION` — the movie's formats, or `''` when it has none. */
  protected formatNames(): string {
    return this.group()
      .movie.formats.map((format) => format.name)
      .join(' · ');
  }
}

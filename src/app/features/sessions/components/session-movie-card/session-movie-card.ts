import { Component, input, output } from '@angular/core';
import { Movie } from '../../../../core/models/movie';
import { MovieSession, MovieSessionGroup } from '../../../../core/models/session';
import { SessionTimePill } from '../session-time-pill/session-time-pill';

/**
 * One movie's block in the showtimes list: poster, title, age-rating badge,
 * runtime + formats, and the horizontally scrolling row of its session pills.
 *
 * Presentational: pill clicks are re-emitted as `select` together with the movie
 * they belong to, because starting a booking needs the film's slug, title and age
 * rating — values the pill does not have. The page stays the owner of the
 * booking flow.
 *
 * `ageRestricted` is passed in rather than derived here so the page owns the
 * eligibility check; the card only spreads it over its pills.
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

  /** Whether this movie's screenings are blocked by the account's age. */
  readonly ageRestricted = input(false);

  /** The restriction message shown on the blocked pills. */
  readonly restrictionMessage = input('');

  /** A session pill was clicked, with the movie it belongs to. */
  readonly select = output<{ movie: Movie; session: MovieSession }>();

  /** `PANORAMA · MOTION` — the movie's formats, or `''` when it has none. */
  protected formatNames(): string {
    return this.group()
      .movie.formats.map((format) => format.name)
      .join(' · ');
  }
}

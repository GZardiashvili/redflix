import { Component, computed, input, output } from '@angular/core';
import { MovieSession } from '../../../../core/models/session';

/** Seats at or below this count render the low-availability accent. */
const LOW_SEATS = 5;

/**
 * One screening tile from the Movie Details design: a time-and-details half, a
 * dashed divider, then the price and availability half.
 *
 * Every value is the API's own: `time`, `format.name`, `language.code`,
 * `price`, `seatsLeft` and `isSoldOut`. Sold-out screenings stay on screen and
 * read "Sold out" — the API's flag is authoritative, so a low `seatsLeft` is
 * never treated as sold out, and `seatsLeft: 0` with `isSoldOut: false` still
 * renders as available.
 *
 * `disabled` is passed in rather than derived here so the page can also disable
 * the tile when the account fails the movie's age check; the two reasons are
 * announced differently through `disabledReason`.
 */
@Component({
  selector: 'app-movie-screening',
  styleUrl: './movie-screening.scss',
  templateUrl: './movie-screening.html',
})
export class MovieScreening {
  /** The screening this tile shows. */
  readonly session = input.required<MovieSession>();

  /**
   * Whether the tile is inert. Set for a sold-out screening and for one the
   * current account is not old enough to buy.
   */
  readonly disabled = input(false);

  /** Whether the reason for `disabled` is the age restriction rather than availability. */
  readonly ageRestricted = input(false);

  /** Emitted when an enabled tile is activated. */
  readonly selected = output<MovieSession>();

  /** Whether the seats badge should warn about low availability. */
  protected readonly isLow = computed(
    () => !this.session().isSoldOut && this.session().seatsLeft <= LOW_SEATS,
  );

  /** Assistive-technology label: the tile's parts read as one sentence. */
  protected readonly ariaLabel = computed(() => {
    const session = this.session();
    const availability = session.isSoldOut ? 'sold out' : `${session.seatsLeft} seats left`;
    const age = this.ageRestricted() ? ', restricted by the film age rating' : '';

    return `${session.time}, ${session.format.name}, ${session.language.name}, ₾${session.price}, ${availability}${age}`;
  });
}

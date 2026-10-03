import { Component, computed, input } from '@angular/core';
import { MovieDetail } from '../../../../core/models/movie';

/**
 * The design's right-hand `Details` card: director, cast, duration, release date,
 * formats, price and the age-rating note.
 *
 * Every value comes from the API. Rows whose field is empty are skipped rather
 * than filled with placeholder copy, so the card never invents credits.
 */
@Component({
  imports: [],
  selector: 'app-movie-details-panel',
  styleUrl: './movie-details-panel.scss',
  templateUrl: './movie-details-panel.html',
})
export class MovieDetailsPanel {
  /** The movie whose details are listed. */
  readonly movie = input.required<MovieDetail>();

  /** `releaseDate` in the design's `4 September 2026` shape, `''` when unusable. */
  readonly releaseDate = input('');

  /** Format names joined for the FORMATS row, `''` when the movie has none. */
  protected readonly formatNames = computed(() =>
    this.movie()
      .formats.map((format) => format.name)
      .join(', '),
  );

  /** `109 minutes` — the raw runtime count, worded as the design does. */
  protected readonly durationLabel = computed(() => `${this.movie().runtimeMinutes} minutes`);

  /** Genre names for the GENRES row, `''` when the movie has none. */
  protected readonly genreNames = computed(() =>
    this.movie()
      .genres.map((genre) => genre.name)
      .join(', '),
  );
}

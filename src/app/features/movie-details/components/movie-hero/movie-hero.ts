import { Component, computed, input } from '@angular/core';
import { MovieDetail } from '../../../../core/models/movie';

/**
 * Movie Details hero: the backdrop banner with the poster, status badge, title,
 * synopsis, age rating, runtime and format.
 *
 * Purely presentational. It renders the movie it is given and never fetches; the
 * page owns loading and the URL.
 */
@Component({
  imports: [],
  selector: 'app-movie-hero',
  styleUrl: './movie-hero.scss',
  templateUrl: './movie-hero.html',
})
export class MovieHero {
  /** The movie whose details are shown. */
  readonly movie = input.required<MovieDetail>();

  /** `NOW PLAYING` / `COMING SOON`, from the API's own `isComingSoon` flag. */
  readonly statusLabel = input('');

  /** `134 Min` — runtime exactly as the API counts it, in the hero's own unit. */
  protected readonly runtimeLabel = computed(() => `${this.movie().runtimeMinutes} Min`);

  /**
   * First available format name for the hero chip. The API decides the order, and
   * the chip shows one format only — the full list lives in the details panel.
   */
  protected readonly formatLabel = computed(() => this.movie().formats[0]?.name ?? '');

  /**
   * The full synopsis, shown once in the hero under the title.
   *
   * Rendered complete rather than trimmed to a line: the separate body section that
   * used to carry the full text is gone, so anything cut here would simply be lost.
   * Trimmed only to drop surrounding whitespace, and empty when the API sent no copy,
   * so the paragraph is omitted rather than left blank.
   */
  protected readonly synopsis = computed(() => (this.movie().synopsis ?? '').trim());
}

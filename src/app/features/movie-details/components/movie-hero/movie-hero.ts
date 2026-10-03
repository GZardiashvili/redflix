import { Component, computed, input } from '@angular/core';
import { MovieDetail } from '../../../../core/models/movie';

/**
 * Movie Details hero: the backdrop banner with the poster, status badge, title,
 * tagline, age rating, runtime and format.
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

  /** Short blurb for the hero: the synopsis, trimmed to a headline-sized line. */
  protected readonly tagline = computed(() => firstSentence(this.movie().synopsis));
}

/**
 * The hero's one-line blurb. A full synopsis is far longer than the 36px line the
 * design allows, so it is cut at the first sentence break and capped; the complete
 * text is still rendered in the details panel.
 */
function firstSentence(synopsis: string | null): string {
  const text = (synopsis ?? '').trim();

  if (text === '') {
    return '';
  }

  const stop = text.search(/[.!?]\s/);
  const sentence = stop === -1 ? text : text.slice(0, stop + 1);

  return sentence.length > 220 ? `${sentence.slice(0, 219).trimEnd()}…` : sentence;
}

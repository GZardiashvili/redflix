import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../../../core/models/movie';
import { RecentlyViewedService } from '../../../../core/services/recently-viewed.service';

/** Delay between automatic slide advances of the hero carousel. */
const AUTOPLAY_INTERVAL_MS = 6000;

/**
 * Home hero carousel: the featured movies with previous/next controls,
 * slide indicators and autoplay.
 *
 * Autoplay resets on every interaction, pauses while the document is hidden
 * and is disabled entirely under `prefers-reduced-motion`, which also removes
 * the slide transition. Manual navigation wraps around both ends.
 */
@Component({
  imports: [DatePipe, RouterLink],
  selector: 'app-home-hero',
  styleUrl: './home-hero.scss',
  templateUrl: './home-hero.html',
})
export class HomeHero implements OnInit {
  /** Featured movies in API order; index 0 starts as the active title. */
  readonly movies = input.required<Movie[]>();

  /** Raw slide index; normalised against the current movie count on read. */
  private readonly activeIndex = signal(0);

  /**
   * Bumps on every navigation so the active progress fill remounts and its CSS
   * fill animation restarts — including re-selecting the already-active slide.
   */
  protected readonly cycle = signal(0);

  /** Autoplay delay, exposed so the progress fill can sync its duration. */
  protected readonly autoplayMs = AUTOPLAY_INTERVAL_MS;

  /** The slide currently shown, `undefined` only while the list is empty. */
  protected readonly currentIndex = computed(() => {
    const count = this.movies().length;
    return count === 0 ? 0 : this.activeIndex() % count;
  });

  protected readonly activeMovie = computed(() => this.movies()[this.currentIndex()]);

  private readonly recentlyViewed = inject(RecentlyViewedService);
  private readonly destroyRef = inject(DestroyRef);

  private autoplayTimer: number | null = null;
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onVisibilityChange = () => this.handleVisibilityChange();
  private readonly onMotionChange = () => this.restartAutoplay();

  constructor() {
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.motionQuery.addEventListener('change', this.onMotionChange);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.motionQuery.removeEventListener('change', this.onMotionChange);
      this.clearAutoplay();
    });
  }

  ngOnInit(): void {
    // Inputs are set before `ngOnInit`, so the movie count is safe to read here.
    this.restartAutoplay();
  }

  /** Shows the slide at `index`, wrapping around, and restarts autoplay. */
  protected select(index: number): void {
    const count = this.movies().length;
    if (count === 0) {
      return;
    }

    this.activeIndex.set(((index % count) + count) % count);
    this.cycle.update((cycle) => cycle + 1);
    this.restartAutoplay();
  }

  protected previous(): void {
    this.select(this.currentIndex() - 1);
  }

  protected next(): void {
    this.select(this.currentIndex() + 1);
  }

  /** Opens a hero CTA: the visited title is snapshotted into Recently Viewed. */
  protected recordView(): void {
    const movie = this.activeMovie();
    if (movie !== undefined) {
      this.recentlyViewed.record(movie);
    }
  }

  /**
   * Whether the slide has a release date to announce as a premiere.
   *
   * The API ships no "premiere week" copy — only `releaseDate` — so the line is
   * composed from that date in the template. A title without one renders no line
   * rather than a bare `PREMIERE ·`. The month name comes from `DatePipe`, and the
   * uppercasing is the stylesheet's job, which keeps the copy the API's own.
   */
  protected hasRelease(movie: Movie): boolean {
    return movie.releaseDate !== '';
  }

  private restartAutoplay(): void {
    this.clearAutoplay();

    if (this.movies().length < 2 || document.hidden || this.motionQuery.matches) {
      return;
    }

    this.autoplayTimer = window.setTimeout(() => {
      this.autoplayTimer = null;
      // `select` schedules the next tick, keeping the interval self-perpetuating.
      this.select(this.currentIndex() + 1);
    }, AUTOPLAY_INTERVAL_MS);
  }

  private clearAutoplay(): void {
    if (this.autoplayTimer !== null) {
      window.clearTimeout(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.clearAutoplay();
    } else {
      this.restartAutoplay();
    }
  }
}

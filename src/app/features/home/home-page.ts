import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toApiError } from '../../core/api/api-error';
import { Movie } from '../../core/models/movie';
import { MoviesService } from '../../core/services/movies.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../shared/ui/loading/loading-indicator';
import { ComingSoonCard } from './components/coming-soon-card/coming-soon-card';
import { HomeHero } from './components/home-hero/home-hero';
import { MovieCard } from './components/movie-card/movie-card';

@Component({
  imports: [
    ComingSoonCard,
    EmptyState,
    ErrorState,
    HomeHero,
    LoadingIndicator,
    MovieCard,
    RouterLink,
  ],
  selector: 'app-home-page',
  styleUrl: './home-page.scss',
  templateUrl: './home-page.html',
})
export class HomePage implements OnInit {
  private readonly movies = inject(MoviesService);

  protected readonly featured = signal<HomeSection<Movie[]>>(pendingSection());
  protected readonly nowPlaying = signal<HomeSection<Movie[]>>(pendingSection());
  protected readonly comingSoon = signal<HomeSection<Movie[]>>(pendingSection());

  ngOnInit(): void {
    this.loadFeatured();
    this.loadNowPlaying();
    this.loadComingSoon();
  }

  protected loadFeatured(): void {
    this.featured.set(pendingSection());

    this.movies.getFeatured().then(
      (data) => this.featured.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.featured.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }

  protected loadNowPlaying(): void {
    this.nowPlaying.set(pendingSection());

    this.movies.getNowPlaying(NOW_PLAYING_LIMIT).then(
      (data) => this.nowPlaying.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.nowPlaying.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }

  protected loadComingSoon(): void {
    this.comingSoon.set(pendingSection());

    this.movies.getComingSoon(COMING_SOON_LIMIT).then(
      (data) => this.comingSoon.set({ loading: false, data, error: null }),
      (error: unknown) =>
        this.comingSoon.set({ loading: false, data: null, error: sectionError(error) }),
    );
  }
}

/** Loading/success/empty/error state of one independently loaded Home section. */
interface HomeSection<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

const NOW_PLAYING_LIMIT = 6;
const COMING_SOON_LIMIT = 4;

function pendingSection<T>(): HomeSection<T> {
  return { loading: true, data: null, error: null };
}

/**
 * Verbatim server message when the API supplied one, neutral fallback
 * otherwise. Never throws: section state must always be representable.
 */
function sectionError(error: unknown): string {
  return toApiError(error).body?.message ?? 'Could not load movies. Please try again.';
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiResponse } from '../api/api-response';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import { Movie } from '../models/movie';

/**
 * Reusable owner of the movie catalogue endpoints.
 *
 * Thin typed wrappers over `HttpClient`: no caching, no state, no second API
 * abstraction. Features own their loading/error state and call these methods
 * with the limits their layout needs.
 */
@Service()
export class MoviesService {
  private readonly http = inject(HttpClient);

  /** Hero titles flagged as featured (a bookable subset of now-playing). */
  getFeatured(): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.featuredMovies);
  }

  /** Movies currently showing, capped for the Home grid when `limit` is set. */
  getNowPlaying(limit?: number): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.nowPlayingMovies, limit);
  }

  /** Unreleased titles (no sessions); `limit` caps the Home row. */
  getComingSoon(limit?: number): Promise<Movie[]> {
    return this.getMovies(API_ENDPOINTS.comingSoonMovies, limit);
  }

  private async getMovies(
    endpoint:
      | typeof API_ENDPOINTS.featuredMovies
      | typeof API_ENDPOINTS.nowPlayingMovies
      | typeof API_ENDPOINTS.comingSoonMovies,
    limit?: number,
  ): Promise<Movie[]> {
    let params = new HttpParams();

    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }

    const response = await firstValueFrom(
      this.http.get<ApiResponse<Movie[]>>(apiUrl(endpoint), { params }),
    );

    return response.data;
  }
}

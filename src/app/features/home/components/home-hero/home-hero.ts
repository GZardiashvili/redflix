import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Movie } from '../../../../core/models/movie';

/**
 * Home hero base rendering: the first featured movie as the active title.
 *
 * Data comes from `/movies/featured` through the Home page; this component
 * owns only presentation. Carousel behavior (autoplay, transitions,
 * previous/next, indicator interaction) belongs to Task 09, so the controls
 * below render in place but stay non-interactive for now.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-home-hero',
  styleUrl: './home-hero.scss',
  templateUrl: './home-hero.html',
})
export class HomeHero {
  /** Featured movies in API order; the first is the active title. */
  readonly movies = input.required<Movie[]>();

  protected readonly activeMovie = computed(() => this.movies()[0]);

  protected genreNames(movie: Movie): string {
    return movie.genres.map((genre) => genre.name).join(' • ');
  }
}

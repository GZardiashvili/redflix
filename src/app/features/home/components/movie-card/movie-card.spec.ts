import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { Movie } from '../../../../core/models/movie';
import { RecentlyViewedService } from '../../../../core/services/recently-viewed.service';
import { MovieCard } from './movie-card';

describe('MovieCard', () => {
  // The card links into the Movie Details route, so the router needs one that
  // actually resolves: a navigation with no matching route is rejected, and a
  // navigation still in flight when the fixture is torn down rejects too.
  @Component({ template: '' })
  class MovieDetailsStub {}

  /** Catalogue summary; only `synopsis` is overridden per test. */
  function aMovie(synopsis?: string | null): Movie {
    return {
      id: 1,
      slug: 'the-odyssey',
      title: 'The Odyssey',
      kind: 'film',
      runtimeMinutes: 102,
      posterUrl: '/poster.jpg',
      backdropUrl: '/backdrop.jpg',
      releaseDate: '2026-01-01',
      isComingSoon: false,
      isNotified: false,
      isFeatured: true,
      fromPrice: 14,
      ageRating: { code: '16+', minAge: 16, description: '' },
      genres: [{ id: 1, slug: 'thriller', name: 'Thriller' }],
      formats: [],
      synopsis,
    };
  }

  let record: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<MovieCard>>;

  const root = () => fixture.nativeElement as HTMLElement;
  const card = () => root().querySelector<HTMLAnchorElement>('.movie-card');
  const synopsis = () => root().querySelector<HTMLElement>('.movie-card__synopsis');

  async function render(movie: Movie): Promise<void> {
    fixture.componentRef.setInput('movie', movie);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    record = vi.fn();

    await TestBed.configureTestingModule({
      imports: [MovieCard],
      providers: [
        provideRouter([{ path: 'movies/:slug', component: MovieDetailsStub }]),
        { provide: RecentlyViewedService, useValue: { record } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MovieCard);
  });

  // The whole card is the link to the movie, so the synopsis is only ever rendered
  // inside it rather than alongside the old poster-only anchor.
  it('routes to the movie details page', async () => {
    await render(aMovie('A copy.'));

    expect(card()?.tagName).toBe('A');
    expect(card()?.getAttribute('href')).toBe('/movies/the-odyssey');
  });

  it('snapshots the movie into Recently Viewed when opened', async () => {
    await render(aMovie('A copy.'));

    card()!.click();
    // Let the navigation the click started settle, so nothing is still in flight
    // when the fixture is destroyed.
    await fixture.whenStable();

    expect(record).toHaveBeenCalledOnce();
    expect(record.mock.calls[0][0]).toMatchObject({ id: 1, slug: 'the-odyssey' });
    expect(TestBed.inject(Router).url).toBe('/movies/the-odyssey');
  });

  it('shows the synopsis the catalogue sent', async () => {
    await render(aMovie('While her husband maps a coast, she keeps a second atlas.'));

    expect(synopsis()?.textContent?.trim()).toBe(
      'While her husband maps a coast, she keeps a second atlas.',
    );
  });

  // `synopsis` is optional on the summary, and the API sends an empty string for a
  // title without copy, so neither case may render a placeholder paragraph.
  it('renders an empty synopsis when the catalogue sent none', async () => {
    await render(aMovie(null));

    expect(synopsis()?.textContent).toBe('');
  });
});

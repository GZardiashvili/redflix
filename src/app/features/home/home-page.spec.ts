import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Movie } from '../../core/models/movie';
import { MoviesService } from '../../core/services/movies.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';
import { HomePage } from './home-page';

/** Minimal summary, enough for the card to render. */
function aMovie(id: number): Movie {
  return {
    id,
    slug: `movie-${id}`,
    title: `Movie ${id}`,
    kind: 'film',
    runtimeMinutes: 120,
    posterUrl: `/poster-${id}.jpg`,
    backdropUrl: `/backdrop-${id}.jpg`,
    releaseDate: '2026-01-01',
    isComingSoon: true,
    isNotified: false,
    isFeatured: false,
    fromPrice: 0,
    ageRating: { code: '12+', minAge: 12, description: '' },
    genres: [],
    formats: [],
  };
}

describe('HomePage section actions', () => {
  const teaser = [aMovie(1), aMovie(2), aMovie(3), aMovie(4)];
  const full = [...teaser, aMovie(5), aMovie(6), aMovie(7), aMovie(8)];

  /** Every `limit` the page asked `getComingSoon` for, in order. */
  let comingSoonLimits: (number | undefined)[];
  let fixture: ReturnType<typeof TestBed.createComponent<HomePage>>;
  let router: Router;

  const root = () => fixture.nativeElement as HTMLElement;
  const heading = (id: string) => root().querySelector<HTMLElement>(`#${id}`)?.parentElement;
  const seeAll = (headingId: string) =>
    heading(headingId)?.querySelector<HTMLElement>('.home-page__see-all') ?? null;
  const cards = () =>
    root().querySelectorAll('.home-page__cards--coming-soon app-coming-soon-card');

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    comingSoonLimits = [];

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        {
          provide: MoviesService,
          useValue: {
            getFeatured: () => Promise.resolve([]),
            getNowPlaying: () => Promise.resolve([]),
            // The service's own `limit` is what the template contract turns into
            // the query string; recording it here is what proves "no limit".
            getComingSoon: (limit?: number) => {
              comingSoonLimits.push(limit);
              return Promise.resolve(limit === undefined ? full : teaser);
            },
            notifyMovie: () => Promise.resolve({ subscribed: true }),
          },
        },
        {
          provide: RecentlyViewedService,
          useValue: { items: vi.fn(() => []) },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(HomePage);
    await render();
  });

  it('renders the capped teaser first', () => {
    expect(comingSoonLimits).toEqual([4]);
    expect(cards().length).toBe(4);
  });

  it('leaves Now Playing pointing at /sessions', () => {
    const control = seeAll('now-playing-heading');

    expect(control?.tagName).toBe('A');
    expect(control?.getAttribute('href')).toBe('/sessions');
  });

  it('does not make the Coming Soon control a navigation link', () => {
    expect(seeAll('coming-soon-heading')?.tagName).toBe('BUTTON');
  });

  it('expands in place with no limit, and never navigates', async () => {
    const navigate = vi.spyOn(router, 'navigate');

    seeAll('coming-soon-heading')!.click();
    await render();

    // No `limit` is the documented way to ask for the whole catalogue.
    expect(comingSoonLimits).toEqual([4, undefined]);
    expect(cards().length).toBe(full.length);
    expect(navigate).not.toHaveBeenCalled();
    expect(seeAll('coming-soon-heading')?.textContent?.trim()).toBe('Show less');
    expect(seeAll('coming-soon-heading')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses back to the teaser', async () => {
    seeAll('coming-soon-heading')!.click();
    await render();

    seeAll('coming-soon-heading')!.click();
    await render();

    expect(comingSoonLimits).toEqual([4, undefined, 4]);
    expect(cards().length).toBe(4);
    expect(seeAll('coming-soon-heading')?.textContent?.trim()).toBe('See all');
    expect(seeAll('coming-soon-heading')?.getAttribute('aria-expanded')).toBe('false');
  });
});

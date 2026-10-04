import { TestBed } from '@angular/core/testing';
import { MovieDetail } from '../../../../core/models/movie';
import { MovieHero } from './movie-hero';

describe('MovieHero', () => {
  const SYNOPSIS =
    'While her husband maps a coast he will never sail, she keeps a second atlas of ' +
    'the places he leaves out, and it becomes the more accurate of the two. By the ' +
    'end of the summer the whole coast has been redrawn twice, and only one of the ' +
    'two women admits it.';

  let fixture: ReturnType<typeof TestBed.createComponent<MovieHero>>;

  const root = () => fixture.nativeElement as HTMLElement;
  const synopsis = () => root().querySelector<HTMLElement>('.hero__synopsis');

  function aMovie(synopsis: string | null): MovieDetail {
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
      director: null,
      cast: null,
      availableDates: [],
    };
  }

  async function render(movie: MovieDetail): Promise<void> {
    fixture.componentRef.setInput('movie', movie);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MovieHero] }).compileComponents();

    fixture = TestBed.createComponent(MovieHero);
  });

  // The hero is the page's only copy of the synopsis now, so the text it used to cut
  // to the first sentence and cap at 220 characters would simply be lost. These pin
  // the text down rather than its styling, which the stylesheet owns.
  it('renders the whole synopsis, not just its opening sentence', async () => {
    await render(aMovie(SYNOPSIS));

    expect(synopsis()?.textContent?.trim()).toBe(SYNOPSIS);
  });

  it('renders no paragraph when the API sent no synopsis', async () => {
    await render(aMovie(null));

    expect(synopsis()).toBeNull();
  });

  it('trims only the surrounding whitespace', async () => {
    await render(aMovie(`\n  ${SYNOPSIS}  \n`));

    expect(synopsis()?.textContent).toBe(SYNOPSIS);
  });
});

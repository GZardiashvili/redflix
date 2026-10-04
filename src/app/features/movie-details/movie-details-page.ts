import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { MovieDetail } from '../../core/models/movie';
import { MovieSession, VenueSessions } from '../../core/models/session';
import { AuthService } from '../../core/services/auth.service';
import { MoviesService } from '../../core/services/movies.service';
import { todayIso } from '../sessions/session-date';
import { BookingEntryService } from '../booking/booking-entry.service';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../shared/ui/error-state/error-state';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';
import { MovieDetailsPanel } from './components/movie-details-panel/movie-details-panel';
import { MovieHero } from './components/movie-hero/movie-hero';
import { MovieShowtimes } from './components/movie-showtimes/movie-showtimes';
import { formatReleaseDate } from './movie-release-date';
import { ageEligibility, restrictionMessage } from '../../shared/utils/screening-eligibility';

/**
 * Movie Details page at `/movies/:slug`: the title's backdrop, poster and detail
 * fields, plus its showtimes for a chosen day.
 *
 * The slug comes from the route, so the page works when opened directly or
 * refreshed. It listens to `ActivatedRoute.paramMap` rather than reading the
 * snapshot once, so navigating between two movies — or using Back/Forward —
 * reloads the new slug and clears the previous result instead of leaving stale
 * content on screen.
 *
 * The movie and its sessions are two independent requests with two independent
 * states: the detail request owns the full-page skeleton and the not-found and
 * error branches, while the session request only ever occupies the Sessions
 * column. That way switching date never blanks the hero or the details card.
 *
 * Booking starts through {@link BookingEntryService}: it holds the screening,
 * runs the login and profile gates and only then opens the booking dialog. The
 * page owns none of that state.
 */
@Component({
  imports: [
    EmptyState,
    ErrorState,
    MovieDetailsPanel,
    MovieHero,
    MovieShowtimes,
    RouterLink,
    Skeleton,
  ],
  selector: 'app-movie-details-page',
  styleUrl: './movie-details-page.scss',
  templateUrl: './movie-details-page.html',
})
export class MovieDetailsPage {
  private readonly movies = inject(MoviesService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly booking = inject(BookingEntryService);

  /** The loaded movie, or `null` while loading or after a failure. */
  protected readonly movie = signal<MovieDetail | null>(null);

  /** Whether a request is in flight. */
  protected readonly loading = signal(true);

  /**
   * Failure message for a non-404 request, `null` otherwise. A missing movie is
   * tracked separately because the design calls for a not-found state rather than
   * a generic error.
   */
  protected readonly error = signal<string | null>(null);

  /** Whether the API reported no movie for this slug. */
  protected readonly notFound = signal(false);

  /**
   * Whether a chosen screening is waiting on the account's profile being
   * completed. The booking dialog stays closed in that case, so the page says so
   * rather than letting the click look like it did nothing.
   */
  protected readonly bookingBlockedByProfile = this.booking.blockedByProfile;

  /**
   * Calendar day the Sessions column is showing, `YYYY-MM-DD`. Always starts on
   * today and is reset to today whenever the slug changes, so a second movie
   * never inherits the first movie's day.
   */
  private readonly selectedDate = signal(todayIso());

  /** Venue groups for {@link selectedDate}, exactly as the API grouped them. */
  private readonly sessionGroups = signal<VenueSessions[]>([]);

  /** Whether the sessions request is in flight. */
  private readonly sessionsLoading = signal(false);

  /** Failure message of the sessions request, `null` otherwise. */
  private readonly sessionsError = signal<string | null>(null);

  /** Bumped by Retry so the sessions request re-runs for the same day. */
  private readonly sessionsRetry = signal(0);

  /** The slug currently shown, so a late response can be matched against it. */
  private readonly currentSlug = signal('');

  /**
   * Monotonic request token. A response from a slug the user has already left is
   * discarded, so a slow request cannot overwrite the movie now on screen.
   */
  private sequence = 0;

  /** `releaseDate` in the design's `4 September 2026` shape, `''` when unusable. */
  protected readonly releaseDate = computed(() => formatReleaseDate(this.movie()?.releaseDate));

  /** `NOW PLAYING` / `COMING SOON`, taken from the API's own flag. */
  protected readonly statusLabel = computed(() =>
    this.movie()?.isComingSoon ? 'COMING SOON' : 'NOW PLAYING',
  );

  /** Days the movie plays, straight from the detail response. */
  protected readonly availableDates = computed(() => this.movie()?.availableDates ?? []);

  /** The day the Sessions column is showing. */
  protected readonly date = this.selectedDate.asReadonly();

  /** Venue groups for the selected day, for the Sessions column. */
  protected readonly groups = this.sessionGroups.asReadonly();

  /** Whether the Sessions column is loading. */
  protected readonly sessionsAreLoading = this.sessionsLoading.asReadonly();

  /** Sessions failure message, `null` otherwise. */
  protected readonly sessionsFailure = this.sessionsError.asReadonly();

  /**
   * Whether this account is blocked from buying this movie's screenings.
   *
   * The movie's own `ageRating.minAge` decides, and a guest is never blocked —
   * the check belongs after login. An authenticated account the server can give no
   * age for counts as blocked, so missing data cannot slip past the rating.
   */
  protected readonly ageRestricted = computed(() => {
    const movie = this.movie();

    if (movie === null) {
      return false;
    }

    return ageEligibility(this.auth.user(), movie.ageRating.minAge) !== 'eligible';
  });

  /** The assignment's restriction copy, shown above blocked screenings. */
  protected readonly restrictionCopy = computed(() => {
    const movie = this.movie();

    return movie === null ? '' : restrictionMessage(movie.ageRating.code);
  });

  constructor() {
    // `paramMap` replays the current slug on subscribe, so this performs the
    // initial load as well as every later slug change.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const slug = params.get('slug');

      if (slug !== null && slug !== '') {
        this.loadMovie(slug);
      }
    });

    // Selected date drives the request, so switching days cancels whatever is in
    // flight: a slow response for day A can never land on top of day B's results.
    // The retry signal is part of the same stream, so Retry re-requests the day
    // that is currently selected rather than a remembered one.
    toObservable(
      computed(() => ({
        slug: this.currentSlug(),
        date: this.selectedDate(),
        retry: this.sessionsRetry(),
      })),
    )
      .pipe(
        switchMap(({ slug, date }) => {
          if (slug === '') {
            return EMPTY;
          }

          this.sessionsLoading.set(true);
          this.sessionsError.set(null);
          // Cleared up front: the previous day's sessions must never sit under
          // the newly selected one while its own request is pending.
          this.sessionGroups.set([]);

          return this.movies.getMovieSessions(slug, date).pipe(
            switchMap((response) => of(response.data)),
            catchError((failure: unknown) => {
              const apiError = toApiError(failure);

              this.sessionsError.set(
                apiError.body?.message ?? 'Could not load showtimes. Please try again.',
              );
              this.sessionsLoading.set(false);

              // Swallowed: the error is rendered in place, so the column keeps its
              // own state and the rest of the page is untouched.
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => {
        this.sessionGroups.set(groups);
        this.sessionsLoading.set(false);
      });
  }

  /** Loads one movie by slug, showing the page's loading state meanwhile. */
  protected loadMovie(slug: string): void {
    this.sequence += 1;
    const request = this.sequence;

    this.loading.set(true);
    this.error.set(null);
    this.notFound.set(false);
    // Cleared up front: the previous movie must never sit under the new slug.
    this.movie.set(null);

    // The Sessions column belongs to the new movie: today is selected again and
    // the slug signal drives a fresh request for it. Setting it before the detail
    // response means the two requests are genuinely independent.
    this.currentSlug.set(slug);
    this.selectedDate.set(todayIso());

    this.movies.getMovie(slug).then(
      (movie) => {
        if (request !== this.sequence) {
          return;
        }

        this.movie.set(movie);
        this.loading.set(false);
      },
      (failure: unknown) => {
        if (request !== this.sequence) {
          return;
        }

        const apiError = toApiError(failure);

        this.notFound.set(apiError.status === 404);
        this.error.set(apiError.body?.message ?? 'Could not load this movie. Please try again.');
        this.loading.set(false);
      },
    );
  }

  /** Retry re-requests the slug currently shown in the address bar. */
  protected retry(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    if (slug !== null && slug !== '') {
      this.loadMovie(slug);
    }
  }

  /**
   * A day was picked in the Sessions column. Availability is enforced by the date
   * selector being disabled, so this only ever moves between days the movie plays;
   * setting the signal is what triggers the request for the new day.
   */
  protected onDateSelected(date: string): void {
    this.selectedDate.set(date);
  }

  /**
   * Retry for the Sessions column: re-requests the same movie and the same
   * selected day, leaving the rest of the page untouched.
   */
  protected retrySessions(): void {
    this.sessionsRetry.update((attempt) => attempt + 1);
  }

  /**
   * An eligible screening was chosen.
   *
   * Sold-out and age-blocked tiles are disabled and never reach this handler; the
   * two guards are kept as the last line of defence so a future caller cannot
   * start booking from an ineligible screening.
   *
   * Everything after this point belongs to {@link BookingEntryService}: a guest
   * is sent through the existing login flow with the screening preserved, an
   * incomplete profile parks the screening and routes to `/profile`, and only an
   * eligible account opens the booking dialog.
   */
  protected onScreeningSelected(session: MovieSession): void {
    const movie = this.movie();

    if (movie === null || session.isSoldOut || this.ageRestricted()) {
      return;
    }

    this.booking.select(session, {
      slug: movie.slug,
      title: movie.title,
      ageRating: movie.ageRating,
    });
  }
}

import { Component, computed, input, output } from '@angular/core';
import { MovieSession, VenueSessions } from '../../../../core/models/session';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { Skeleton } from '../../../../shared/ui/skeleton/skeleton';
import { MovieDateSelector } from '../movie-date-selector/movie-date-selector';
import { MovieScreening } from '../movie-screening/movie-screening';

/**
 * The Sessions column of the Movie Details page: the seven-day picker followed by
 * the selected day's screenings, grouped exactly as the API groups them — by
 * venue, and within a venue by the auditorium each screening plays in.
 *
 * The auditorium grouping is presentation only: the API returns one venue group
 * with a flat session list, and the design draws a labelled box per hall. Grouping
 * is done here over the API's own `hall` and preserves the API's ordering, so no
 * value is invented and no second request is made.
 *
 * Presentational throughout: loading, error, empty and eligibility are decided by
 * the page, which passes the resolved state in and reacts to what the visitor does.
 */
@Component({
  imports: [EmptyState, ErrorState, MovieDateSelector, MovieScreening, Skeleton],
  selector: 'app-movie-showtimes',
  styleUrl: './movie-showtimes.scss',
  templateUrl: './movie-showtimes.html',
})
export class MovieShowtimes {
  /** Venue groups for the selected date, exactly as the API returned them. */
  readonly groups = input.required<VenueSessions[]>();

  /** Currently highlighted day (`YYYY-MM-DD`), owned by the page. */
  readonly selectedDate = input.required<string>();

  /** Days the movie plays, `YYYY-MM-DD`, from `MovieDetail.availableDates`. */
  readonly availableDates = input<string[]>([]);

  /** Whether the sessions request for the selected date is in flight. */
  readonly loading = input(false);

  /** Failure message for the sessions request, `null` otherwise. */
  readonly error = input<string | null>(null);

  /** Whether every screening is blocked because of the account's age. */
  readonly ageRestricted = input(false);

  /** The restriction message to show above the blocked screenings. */
  readonly restrictionMessage = input('');

  /** Whether the sessions request has settled with no screenings. */
  protected readonly isEmpty = computed(() => !this.loading() && this.groups().length === 0);

  /**
   * Empty-state copy. A coming-soon movie has no sessions on any day, so the
   * message must not send the visitor looking for another date that cannot be
   * chosen; otherwise it points at the days that do play.
   */
  protected readonly emptyMessage = computed(() =>
    this.availableDates().length === 0
      ? 'This film has no screenings yet. Check back closer to its release.'
      : 'There are no screenings for the selected date. Pick another day to see what is playing.',
  );

  /**
   * Venue name, then its halls, in API order. Venues with no sessions are dropped:
   * an empty group would render a heading with nothing under it.
   */
  protected readonly venues = computed(() =>
    this.groups()
      .filter((group) => group.sessions.length > 0)
      .map((group) => ({ name: group.venue.name, halls: hallsOf(group.sessions) })),
  );

  /** Emitted when another day is picked. */
  readonly dateSelected = output<string>();

  /** Emitted when the retry action is used. */
  readonly retry = output<void>();

  /** Emitted when an enabled screening is activated. */
  readonly screeningSelected = output<MovieSession>();

  /** Placeholder shape of the loading state: two venues, two tiles each. */
  protected readonly skeletonRows = [0, 1];
  protected readonly skeletonTiles = [0, 1];
}

/** One auditorium and its screenings, keeping the API's ordering. */
interface HallGroup {
  readonly name: string;
  readonly sessions: MovieSession[];
}

/** Groups a venue's sessions by auditorium, first-seen order preserved. */
function hallsOf(sessions: MovieSession[]): HallGroup[] {
  const halls = new Map<number, HallGroup>();

  for (const session of sessions) {
    const existing = halls.get(session.hall.id);

    if (existing === undefined) {
      halls.set(session.hall.id, { name: session.hall.name, sessions: [session] });
    } else {
      existing.sessions.push(session);
    }
  }

  return [...halls.values()];
}

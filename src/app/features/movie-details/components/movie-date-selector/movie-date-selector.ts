import { Component, computed, input, output } from '@angular/core';
import { SessionDateOption, todayIso, upcomingDateOptions } from '../../../sessions/session-date';

/**
 * Seven-day picker for the Movie Details page.
 *
 * The days are the same next-seven-calendar-days list the Sessions page offers,
 * built from local date parts so the day never shifts across UTC midnight, and
 * today is always the first tile.
 *
 * A day the movie does not play is kept in the row but disabled: `availableDates`
 * from the movie-detail response is the authoritative list, and hiding the day
 * would leave a gap the visitor could not explain. The selection itself stays
 * with the page — this component only renders `selected` and emits a choice.
 */
@Component({
  selector: 'app-movie-date-selector',
  styleUrl: './movie-date-selector.scss',
  templateUrl: './movie-date-selector.html',
})
export class MovieDateSelector {
  /** Currently highlighted day (`YYYY-MM-DD`), owned by the page. */
  readonly selected = input.required<string>();

  /**
   * Days the movie actually plays, `YYYY-MM-DD`, from
   * `MovieDetail.availableDates`. Absent or empty means no known availability, so
   * every tile stays disabled until the detail response says otherwise.
   */
  readonly availableDates = input<string[]>([]);

  /** Emitted with the local `YYYY-MM-DD` of the day the visitor picked. */
  readonly dateSelected = output<string>();

  /** Today, so a tile can be labelled as such without recomputing it per tile. */
  protected readonly today = todayIso();

  /** The seven days offered, starting today. */
  protected readonly options: SessionDateOption[] = upcomingDateOptions();

  /** Tiles with their availability resolved, ready to render. */
  protected readonly days = computed(() =>
    this.options.map((option) => ({
      ...option,
      available: this.availableDates().includes(option.iso),
    })),
  );

  /** The `title` of an unavailable tile, explaining why it cannot be chosen. */
  protected unavailableLabel(option: SessionDateOption): string {
    return `${option.label} — no screenings`;
  }
}

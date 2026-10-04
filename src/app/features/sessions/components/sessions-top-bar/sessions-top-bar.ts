import { Component, computed, input, output } from '@angular/core';
import { SortOption } from '../../../../core/models/filter-options';

/**
 * Toolbar above the showtimes list: results counter on the left, the sort
 * dropdown on the right.
 *
 * The design's row carries no search field — film titles are searched from the
 * header typeahead, which navigates here with `?q=` — so this only reports how
 * many sessions matched and how to order them.
 *
 * Presentational. The parent owns the state: this component renders the incoming
 * `totalSessions`/`sort` and emits what the user picks, so the URL stays the
 * single source of truth.
 */
@Component({
  imports: [],
  selector: 'app-sessions-top-bar',
  styleUrl: './sessions-top-bar.scss',
  templateUrl: './sessions-top-bar.html',
})
export class SessionsTopBar {
  /**
   * Total sessions reported by `meta.totalSessions` — the API's own count, not
   * the length of the grouped array on the page.
   */
  readonly totalSessions = input.required<number>();

  /** Current sort id; must be one of `sortOptions`. */
  readonly sort = input.required<string>();

  /** Sort options owned by `/filter-options`. */
  readonly sortOptions = input.required<SortOption[]>();

  /** Sort id chosen in the dropdown. */
  readonly sortChanged = output<string>();

  /** `Showing 12 sessions`, or `No sessions found` when the total is zero. */
  protected readonly summary = computed(() => {
    const total = this.totalSessions();
    return total === 0
      ? 'No sessions found'
      : `Showing ${total} ${total === 1 ? 'session' : 'sessions'}`;
  });

  protected onSortChange(value: string): void {
    this.sortChanged.emit(value);
  }
}

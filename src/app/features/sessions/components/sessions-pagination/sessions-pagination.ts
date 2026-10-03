import { Component, computed, input, output } from '@angular/core';

/** One entry in the page list: a page number, or an ellipsis standing in for a gap. */
type PageItem = number | 'gap';

/** How many pages sit on each side of the current one before it is elided. */
const SIBLING_PAGES = 1;

/**
 * Page navigation below the showtimes list.
 *
 * Its state is derived entirely from the API's `meta`: the API pages *movies*, not
 * sessions, so `currentPage`/`lastPage` are the authority here. Nothing is derived
 * from the number of rendered cards. The component only reports the page the user
 * asked for; the page then puts it in the URL.
 */
@Component({
  imports: [],
  selector: 'app-sessions-pagination',
  styleUrl: './sessions-pagination.scss',
  templateUrl: './sessions-pagination.html',
})
export class SessionsPagination {
  /** 1-based page currently shown. */
  readonly currentPage = input.required<number>();

  /** Last available page. */
  readonly lastPage = input.required<number>();

  /** The page the user picked. */
  readonly pageChanged = output<number>();

  /** Whether there is more than one page to move between. */
  protected readonly hasPages = computed(() => this.lastPage() > 1);

  protected readonly isFirst = computed(() => this.currentPage() <= 1);
  protected readonly isLast = computed(() => this.currentPage() >= this.lastPage());

  /**
   * Pages to render: the first and last are always reachable, with the current
   * page and its immediate neighbours in between. Longer runs collapse to an
   * ellipsis so the row stays within the design's width.
   */
  protected readonly pages = computed<PageItem[]>(() => {
    const last = this.lastPage();
    const current = this.currentPage();

    if (last <= 1) {
      return [];
    }

    const lastSafe = Math.min(Math.max(current, 1), last);
    const visible = new Set<number>([1, last]);

    for (let offset = -SIBLING_PAGES; offset <= SIBLING_PAGES; offset += 1) {
      const page = lastSafe + offset;
      if (page >= 1 && page <= last) {
        visible.add(page);
      }
    }

    const sorted = [...visible].sort((a, b) => a - b);
    const items: PageItem[] = [];

    sorted.forEach((page, index) => {
      const previous = sorted[index - 1];

      if (previous !== undefined && page - previous > 1) {
        items.push('gap');
      }

      items.push(page);
    });

    return items;
  });

  protected goTo(page: number): void {
    if (page === this.currentPage() || page < 1 || page > this.lastPage()) {
      return;
    }

    this.pageChanged.emit(page);
  }

  protected previous(): void {
    this.goTo(this.currentPage() - 1);
  }

  protected next(): void {
    this.goTo(this.currentPage() + 1);
  }
}

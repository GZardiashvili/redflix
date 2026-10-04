import { Component, input } from '@angular/core';

/**
 * The age-rating pill of the Home cards.
 *
 * Presentation only. The code is passed in rather than a movie because the cards
 * read it from two shapes: `Movie.ageRating` on the catalogue rows and the
 * flattened `rating` of a Recently Viewed snapshot.
 *
 * `size` exists because the cards it is shared by are not all drawn at the same
 * scale: the Now Playing card uses the design's default 14px pill, while the
 * Coming Soon `Card_medium` is a shorter row that pairs the pill with 12px copy.
 * The default is the design's own, so a card that says nothing keeps the pill it
 * had.
 */
@Component({
  selector: 'app-rating-badge',
  styles: `
    :host {
      display: inline-flex;
      align-self: flex-start;
    }

    .badge {
      padding: 0.25rem 0.75rem; // 4px 12px
      border-radius: 999px;
      background: rgb(236 48 19 / 12%);
      color: #ec3013;
      font-size: 0.875rem; // 14px
      font-weight: 800;
      line-height: 1rem; // 16px
      white-space: nowrap;
    }

    .badge--sm {
      padding: 0.25rem 0.4375rem; // 4px 7px
      background: rgb(236 48 19 / 10%);
      font-size: 0.75rem; // 12px
      line-height: 0.8125rem; // 13px
    }
  `,
  template: `<span class="badge" [class.badge--sm]="size() === 'sm'">{{ code() }}</span>`,
})
export class RatingBadge {
  /** Rating code exactly as the API supplies it, e.g. `12+`. */
  readonly code = input.required<string>();

  /**
   * Which of the two pill scales of the design to draw.
   *
   * `'md'` (the default) is the Now Playing card's; `'sm'` is the shorter Coming
   * Soon row's, where the pill sits beside 12px copy rather than 14px.
   */
  readonly size = input<'md' | 'sm'>('md');
}

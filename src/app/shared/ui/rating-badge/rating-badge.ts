import { Component, input } from '@angular/core';

/**
 * The age-rating pill of the Home cards.
 *
 * Presentation only. The code is passed in rather than a movie because the cards
 * read it from two shapes: `Movie.ageRating` on the catalogue rows and the
 * flattened `rating` of a Recently Viewed snapshot.
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
  `,
  template: `<span class="badge">{{ code() }}</span>`,
})
export class RatingBadge {
  /** Rating code exactly as the API supplies it, e.g. `12+`. */
  readonly code = input.required<string>();
}

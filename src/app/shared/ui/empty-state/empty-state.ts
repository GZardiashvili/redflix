import { Component, input } from '@angular/core';

/**
 * Shown when a request succeeded but produced no content: no search results, no sessions,
 * no tickets, nothing recently viewed.
 *
 * The copy always comes from the feature; optional actions are projected into the default
 * slot.
 */
@Component({
  imports: [],
  selector: 'app-empty-state',
  styleUrl: './empty-state.scss',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  /** Short headline describing what is missing. Supplied by the feature. */
  readonly title = input.required<string>();

  /** Optional supporting line of text. */
  readonly message = input<string>();
}

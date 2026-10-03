import { Component, input } from '@angular/core';

/**
 * Neutral content placeholder shown while async content loads.
 *
 * The block is hidden from assistive technology by default because features
 * announce loading through their own status region (e.g. LoadingIndicator).
 * A `label` opt-in is provided for standalone use, where the placeholder is
 * the only loading indication.
 */
@Component({
  imports: [],
  selector: 'app-skeleton',
  styleUrl: './skeleton.scss',
  templateUrl: './skeleton.html',
  host: {
    '[attr.aria-hidden]': 'label() === null ? "true" : null',
    '[attr.aria-label]': 'label()',
    '[attr.role]': 'label() === null ? null : "status"',
  },
})
export class Skeleton {
  /** Shape of the placeholder. Features compose these into page skeletons. */
  readonly variant = input<'text' | 'block' | 'avatar'>('block');

  /**
   * Accessible label for standalone use. When absent (the default) the
   * placeholder stays hidden from assistive technology.
   */
  readonly label = input<string | null>(null);
}

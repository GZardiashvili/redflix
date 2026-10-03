import { Component, input } from '@angular/core';

/**
 * Consistent loading indication for async work: submit buttons, content areas and future
 * data-loading states.
 *
 * The visible text is screen-reader only, so the same component works inline in a button and
 * as a standalone block. Feature copy is never baked in here.
 */
@Component({
  imports: [],
  selector: 'app-loading-indicator',
  styleUrl: './loading-indicator.scss',
  templateUrl: './loading-indicator.html',
})
export class LoadingIndicator {
  /** Announced to assistive technology while the operation is running. */
  readonly label = input('Loading');

  /** `sm` for inline/button use, `md` for standalone content areas. */
  readonly size = input<'sm' | 'md'>('md');
}

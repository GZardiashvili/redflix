import { Component, input, output } from '@angular/core';

/**
 * Displays an async/content failure with an optional retry action.
 *
 * It only renders the text it is given: deciding what a `401`, `403`, `409`, `422` or `500`
 * means belongs to the feature or infrastructure layer, which passes the resulting message
 * (including any server-provided text) to this component unchanged.
 */
@Component({
  imports: [],
  selector: 'app-error-state',
  styleUrl: './error-state.scss',
  templateUrl: './error-state.html',
})
export class ErrorState {
  /** The failure text to show. Server messages are passed through verbatim. */
  readonly message = input.required<string>();

  /** Neutral fallback heading; features override it with their own copy. */
  readonly title = input('Something went wrong');

  /** Whether a retry action should be offered. */
  readonly canRetry = input(false);

  /** Label of the retry action. */
  readonly retryLabel = input('Retry');

  /** Emitted when the user activates the retry action; the parent owns what retrying does. */
  readonly retry = output<void>();
}

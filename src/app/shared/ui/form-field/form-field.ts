import { Component, computed, input } from '@angular/core';

/**
 * Neutral form-field presentation wrapper shared by future forms
 * (login, registration, profile, booking).
 *
 * Owns label association and message presentation only. Validation,
 * form-control wiring and API behaviour stay in the feature.
 */
@Component({
  imports: [],
  selector: 'app-form-field',
  styleUrl: './form-field.scss',
  templateUrl: './form-field.html',
})
export class FormField {
  /** Visible label text. Supplied by the feature. */
  readonly label = input.required<string>();

  /** `id` of the projected control; used for the label association. */
  readonly controlId = input.required<string>();

  /** Validation message. Takes precedence over `hint` when present. */
  readonly error = input<string | null>(null);

  /** Supporting text shown only when there is no error. */
  readonly hint = input<string | null>(null);

  /** Whether to render a required marker next to the label. */
  readonly required = input(false);

  protected readonly errorId = computed(() => `${this.controlId()}-error`);
  protected readonly hintId = computed(() => `${this.controlId()}-hint`);
}

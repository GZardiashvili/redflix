import { Component, computed, input } from '@angular/core';
import { Seat } from '../../../../../core/models/seat';

/**
 * One seat of the map, rendered exactly as the API describes it.
 *
 * The four states are visually distinct on purpose: `held` must not look like
 * `sold`, because a hold is temporary and frees the seat when it expires.
 * `unavailable` is not rendered at all — it means there is no seat in that
 * position, so the row reserves the space with a gap instead of drawing a control
 * the visitor could try to use.
 *
 * This task renders the map only. Seats are inert: no click handler, no
 * selection, no `aria-pressed`. Selection, ticket types and the three-seat rule
 * arrive with the next step, which is also what turns these into buttons.
 */
@Component({
  selector: 'app-seat',
  styleUrl: './seat.scss',
  templateUrl: './seat.html',
})
export class SeatComponent {
  /** The seat to render. */
  readonly seat = input.required<Seat>();

  /**
   * Assistive-technology name: identity and state in one phrase, e.g.
   * `Seat A7, available`.
   */
  protected readonly label = computed(() => `Seat ${this.seat().code}, ${this.seat().state}`);
}

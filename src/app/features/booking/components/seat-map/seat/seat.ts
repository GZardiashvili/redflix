import { Component, computed, input, output } from '@angular/core';
import { Seat } from '../../../../../core/models/seat';

/**
 * One seat of the map.
 *
 * The four states are visually distinct on purpose: `held` must not look like
 * `sold`, because a hold is temporary and frees the seat when it expires.
 * `unavailable` is never rendered here at all — it means there is no seat in that
 * position, so the row reserves the space with a gap instead of drawing a control
 * the visitor could try to use.
 *
 * An `available` seat is a real `button` with `aria-pressed`, so selecting and
 * deselecting are one activation and assistive technology reads the state
 * without inferring it from the colour. `sold` and `held` seats keep the inert
 * element and carry no click handler at all: there is nothing to select, and an
 * `aria-pressed` on a control that can never change would be a lie.
 *
 * Whether a seat is selected is decided by {@link SeatSelectionService} and
 * passed in. This component owns no selection state, no pricing and no HTTP.
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
   * Whether the visitor currently holds this seat.
   *
   * Only meaningful for an `available` seat: the other states cannot be selected,
   * so the value is ignored for them.
   */
  readonly selected = input(false);

  /** Emitted when an available seat is activated. */
  readonly toggled = output<Seat>();

  /**
   * Assistive-technology name: identity and state in one phrase, e.g.
   * `Seat A7, available, selected`.
   */
  protected readonly label = computed(() => {
    const seat = this.seat();
    const state = seat.state === 'available' && this.selected() ? 'selected' : seat.state;

    return `Seat ${seat.code}, ${state}`;
  });

  /**
   * Activates the seat.
   *
   * Guarded as well as being unreachable from the template: the handler is
   * emitted rather than handled here, so a sold seat can never reach the
   * selection owner even if a future caller wires it differently.
   */
  protected select(): void {
    const seat = this.seat();

    if (seat.state === 'available') {
      this.toggled.emit(seat);
    }
  }
}

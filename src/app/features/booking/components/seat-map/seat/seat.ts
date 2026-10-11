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

  /** Emitted when a selectable seat is activated. */
  readonly toggled = output<Seat>();

  /**
   * Whether this seat is drawn as an interactive control rather than an inert
   * tile.
   *
   * An `available` seat is always selectable. A `held` seat is selectable too
   * when it is the visitor's own hold (`isMine`) or is already part of the
   * selection — a hold recovered after a refresh is still theirs to change, so
   * it must not be locked like another visitor's hold. `sold` and a
   * third-party `held` seat stay inert.
   */
  protected readonly interactive = computed(
    () => this.seat().state === 'available' || this.seat().isMine || this.selected(),
  );

  /**
   * Whether the seat is drawn in the selected (accent) visual state.
   *
   * This follows the selection, not the server's `isMine` flag: the selection
   * is the single source of truth for what the visitor has chosen, and it is
   * what must move the moment a seat is dropped — by clicking the tile or the
   * summary's remove control — even though the seat map is not refetched and so
   * still reports the seat as held. A seat recovered from a hold is put back
   * into the selection on restore, so it shows as chosen on that basis alone;
   * coupling the colour to `isMine` would leave a removed seat stuck looking
   * selected until the map reloaded.
   */
  protected readonly shownSelected = computed(() => this.selected());

  /**
   * Assistive-technology name: identity and state in one phrase, e.g.
   * `Seat A7, available, selected`.
   */
  protected readonly label = computed(() => {
    const seat = this.seat();
    const state = this.shownSelected() ? 'selected' : seat.state;

    return `Seat ${seat.code}, ${state}`;
  });

  /**
   * Activates the seat.
   *
   * Guarded as well as being unreachable from the template: the handler is
   * emitted rather than handled here, so a sold or third-party-held seat can
   * never reach the selection owner even if a future caller wires it
   * differently.
   */
  protected select(): void {
    if (this.interactive()) {
      this.toggled.emit(this.seat());
    }
  }
}

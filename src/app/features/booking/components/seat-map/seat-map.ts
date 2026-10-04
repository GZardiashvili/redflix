import { Component, inject, input } from '@angular/core';
import { Seat, SessionSeatMap } from '../../../../core/models/seat';
import { SeatSelectionService } from '../../seat-selection.service';
import { SeatSectionComponent } from './seat-section/seat-section';

/**
 * The hall layout of one screening.
 *
 * Presentational: the request, the session and every loading/error decision
 * belong to the Step 1 slot, which passes the already-loaded map in. The API's
 * `sections → rows → seats` shape is rendered exactly as received, so sections
 * keep their own names, order and row widths.
 *
 * The screen bar above the seats is a static caption from the design. It carries no
 * seat data and no geometry — the API is the only source of what the hall contains.
 *
 * This component draws the scrolling canvas only. The seat legend is deliberately
 * not part of it: it belongs to Step 1's column footer, outside the scroll area, so
 * a tall hall can never scroll the key half out of view or drop the map's
 * horizontal scrollbar on top of it.
 *
 * Selection is composed here but owned elsewhere: the map reads which seats are
 * selected from {@link SeatSelectionService} and hands an activated seat back to
 * it. Nothing below this component decides what may be selected.
 */
@Component({
  imports: [SeatSectionComponent],
  selector: 'app-seat-map',
  styleUrl: './seat-map.scss',
  templateUrl: './seat-map.html',
})
export class SeatMap {
  private readonly selection = inject(SeatSelectionService);

  /** The loaded layout of the current screening. */
  readonly map = input.required<SessionSeatMap>();

  /** Which seats are currently chosen, relayed down to the sections. */
  protected readonly selectedSeatIds = this.selection.selectedSeatIds;

  /** Selects an available seat, or deselects one that is already selected. */
  protected toggleSeat(seat: Seat): void {
    this.selection.toggle(seat);
  }
}

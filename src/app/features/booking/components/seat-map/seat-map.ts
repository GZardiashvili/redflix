import { Component, input } from '@angular/core';
import { SessionSeatMap } from '../../../../core/models/seat';
import { SeatMapLegendComponent } from './seat-map-legend/seat-map-legend';
import { SeatSectionComponent } from './seat-section/seat-section';

/**
 * The hall layout of one screening.
 *
 * Purely presentational: the request, the session and every loading/error decision
 * belong to the Step 1 slot, which passes the already-loaded map in. The API's
 * `sections → rows → seats` shape is rendered exactly as received, so sections keep
 * their own names, order and row widths.
 *
 * The screen bar above the seats is a static caption from the design. It carries no
 * seat data and no geometry — the API is the only source of what the hall contains.
 */
@Component({
  imports: [SeatMapLegendComponent, SeatSectionComponent],
  selector: 'app-seat-map',
  styleUrl: './seat-map.scss',
  templateUrl: './seat-map.html',
})
export class SeatMap {
  /** The loaded layout of the current screening. */
  readonly map = input.required<SessionSeatMap>();
}

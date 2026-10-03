import { Component, input } from '@angular/core';
import { SeatRow } from '../../../../../core/models/seat';
import { SeatComponent } from '../seat/seat';

/**
 * One row of a section: the API's row label, then its seats in the order and at
 * the positions the API sent them.
 *
 * The row is a flex line rather than a grid with a fixed column count, because the
 * API decides the geometry: rows differ in width (6 to 14 seats in the live halls)
 * and contain gangways and missing positions at different places. Two kinds of
 * spacing keep that geometry intact:
 *
 * * an `unavailable` seat becomes an empty slot the size of a seat, so a gap left
 *   by a gangway or a wheelchair space still holds the row open;
 * * `aisleAfter` adds a gangway spacer directly after that seat.
 *
 * The label is printed exactly as received. Rows are not always contiguous —
 * one hall runs `A`–`G` and then `J`, `K`, `L` — so nothing is derived from an
 * index or completed alphabetically.
 */
@Component({
  imports: [SeatComponent],
  selector: 'app-seat-row',
  styleUrl: './seat-row.scss',
  templateUrl: './seat-row.html',
})
export class SeatRowComponent {
  /** The row to render. */
  readonly row = input.required<SeatRow>();
}

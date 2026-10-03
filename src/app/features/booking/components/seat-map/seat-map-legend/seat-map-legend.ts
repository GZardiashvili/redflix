import { Component } from '@angular/core';

/** One legend entry: a swatch in a seat state plus what it means. */
interface LegendItem {
  readonly key: string;
  readonly label: string;
}

/**
 * Key to the seat states the map draws.
 *
 * The list is fixed by what is actually rendered — the three states the API can
 * return a seat in, plus the missing-position gap that keeps a row's shape. It is
 * not derived from whatever one hall happens to contain, so the key does not
 * change from screening to screening. `isMine` is deliberately absent: it marks the
 * visitor's own hold rather than a state the map offers, so it gets no entry.
 */
@Component({
  selector: 'app-seat-map-legend',
  styleUrl: './seat-map-legend.scss',
  templateUrl: './seat-map-legend.html',
})
export class SeatMapLegendComponent {
  protected readonly items: readonly LegendItem[] = [
    { key: 'available', label: 'Available' },
    { key: 'sold', label: 'Sold' },
    { key: 'held', label: 'Held by another visitor' },
    { key: 'gap', label: 'No seat' },
  ];
}

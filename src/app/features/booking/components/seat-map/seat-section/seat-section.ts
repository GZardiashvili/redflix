import { Component, input, output } from '@angular/core';
import { Seat, SeatSection } from '../../../../../core/models/seat';
import { SeatRowComponent } from '../seat-row/seat-row';

/**
 * One block of the hall — `Stalls`, `Balcony`, `Circle`, `Boxes`,
 * `Front stalls`, `Rear stalls`, whatever the API sends.
 *
 * Sections stay separate visual blocks with the API's own name and order, and
 * each keeps its rows at their own widths. The halls differ genuinely: one has a
 * single 9-seat section, another has three sections of 13, 13 and 6 seats, and a
 * third has 10-seat front rows behind 14-seat rear rows. Rendering them as one
 * flat grid would erase exactly the shape the visitor needs to read.
 *
 * Selection is relayed to the rows and back out again; the section itself holds
 * none of it.
 */
@Component({
  imports: [SeatRowComponent],
  selector: 'app-seat-section',
  styleUrl: './seat-section.scss',
  templateUrl: './seat-section.html',
})
export class SeatSectionComponent {
  /** The section to render. */
  readonly section = input.required<SeatSection>();

  /** Ids of the seats currently held by the visitor. */
  readonly selectedSeatIds = input<ReadonlySet<number>>(new Set<number>());

  /** Emitted when one of this section's available seats is activated. */
  readonly seatToggled = output<Seat>();
}

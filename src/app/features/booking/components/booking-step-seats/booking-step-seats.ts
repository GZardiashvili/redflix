import { Component, computed, inject } from '@angular/core';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { BookingHoldService } from '../../booking-hold.service';
import { DragToPan } from '../../drag-to-pan.directive';
import { SeatMapService } from '../../seat-map.service';
import { SeatMap } from '../seat-map/seat-map';
import { SeatMapLegendComponent } from '../seat-map/seat-map-legend/seat-map-legend';
import { SeatSelectionSummary } from '../seat-selection-summary/seat-selection-summary';

/**
 * Step 1 of the booking flow: the seat map of the screening being booked, beside
 * the summary of what the visitor has picked.
 *
 * The slot owns only the three states the request can be in — loading, failed,
 * loaded — and delegates everything else. Which screening is shown comes from
 * {@link SeatMapService}, which follows the booking state, so the map always
 * matches the header above it and never outlives the booking that requested it.
 *
 * A failure is rendered in place: the dialog, its header and the step indicator
 * stay exactly as they were, and Retry re-requests the same session id. A failed
 * request is never dressed up as an empty hall.
 *
 * The summary sits beside the map rather than below it and holds no selection
 * state of its own: both columns read the same selection owner, so the seats drawn
 * on the map and the seats listed with prices cannot disagree.
 *
 * Only the map canvas moves. The seat key is a sibling of the scroll area inside
 * the same column, so it is never clipped by the scroll and never sits underneath
 * the canvas — the two share the column's height instead, with the key taking a
 * fixed slice of it and the map taking the rest.
 *
 * The canvas is pannable rather than scrolled by hand: {@link DragToPan} turns
 * the viewport into a press-and-drag surface, and its scrollbars are hidden, so a
 * hall wider or taller than the panel is explored the way a map is instead of
 * being pushed around behind visible bars.
 */
@Component({
  imports: [
    DragToPan,
    EmptyState,
    ErrorState,
    LoadingIndicator,
    SeatMap,
    SeatMapLegendComponent,
    SeatSelectionSummary,
  ],
  selector: 'app-booking-step-seats',
  styleUrl: './booking-step-seats.scss',
  templateUrl: './booking-step-seats.html',
})
export class BookingStepSeats {
  private readonly seatMap = inject(SeatMapService);
  private readonly hold = inject(BookingHoldService);

  /** The loaded layout, or `null` while loading or after a failure. */
  protected readonly map = this.seatMap.map;

  protected readonly loading = this.seatMap.loading;
  protected readonly error = this.seatMap.error;
  protected readonly isEmpty = this.seatMap.isEmpty;

  /**
   * Re-requests the current session's seat map after a failure.
   *
   * The same action the hold flow takes after a conflict or an expiry; only the
   * reason for asking differs.
   */
  protected retry(): void {
    this.seatMap.refresh();
  }

  /**
   * Why the last attempt to continue failed, or `null` when there is nothing to
   * report. Read from the hold service, which owns the reconciliation.
   */
  protected readonly failure = this.hold.failure;

  /**
   * The seats a `409` took away, as the single sentence the design shows:
   * `Some of those seats were just taken: A1, A2`.
   *
   * Composed here rather than in the service so the service keeps one message —
   * the API's own — and the seat-list formatting stays a rendering concern. The
   * codes are the API's stable seat identities, never a position on screen, so
   * the list is exactly what the visitor saw labelled on the map.
   *
   * The API's sentence is trimmed of its closing full stop before the codes are
   * appended: it writes the message as a finished sentence, and joining a list to
   * one produces `just taken.: A1`, which reads as a typo rather than a sentence
   * with a list on it. The wording itself is never touched.
   */
  protected readonly conflictMessage = computed(() => {
    const failure = this.failure();

    if (failure === null || failure.contested.length === 0) {
      return null;
    }

    return `${failure.message.replace(/\.\s*$/, '')}: ${failure.contested.join(', ')}`;
  });
}

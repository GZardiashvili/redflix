import { Component, inject } from '@angular/core';
import { EmptyState } from '../../../../shared/ui/empty-state/empty-state';
import { ErrorState } from '../../../../shared/ui/error-state/error-state';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { SeatMapService } from '../../seat-map.service';
import { SeatMap } from '../seat-map/seat-map';
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
 */
@Component({
  imports: [EmptyState, ErrorState, LoadingIndicator, SeatMap, SeatSelectionSummary],
  selector: 'app-booking-step-seats',
  styleUrl: './booking-step-seats.scss',
  templateUrl: './booking-step-seats.html',
})
export class BookingStepSeats {
  private readonly seatMap = inject(SeatMapService);

  /** The loaded layout, or `null` while loading or after a failure. */
  protected readonly map = this.seatMap.map;

  protected readonly loading = this.seatMap.loading;
  protected readonly error = this.seatMap.error;
  protected readonly isEmpty = this.seatMap.isEmpty;

  /** Re-requests the current session's seat map. */
  protected retry(): void {
    this.seatMap.retry();
  }
}

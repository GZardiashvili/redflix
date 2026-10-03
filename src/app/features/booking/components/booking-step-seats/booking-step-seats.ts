import { Component } from '@angular/core';

/**
 * Content slot for Step 1 of the booking flow.
 *
 * The seat map itself is a later task: this component owns only the shell's
 * content area, so it deliberately renders no seats, no legend and no totals.
 * Those are placeholders that would have to be thrown away, and faking them
 * would misrepresent what the screen can already do.
 */
@Component({
  selector: 'app-booking-step-seats',
  styleUrl: './booking-step-seats.scss',
  templateUrl: './booking-step-seats.html',
})
export class BookingStepSeats {}

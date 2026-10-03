import { Component } from '@angular/core';

/**
 * Content slot for Step 2 of the booking flow.
 *
 * The checkout form and the payment request are later tasks: this component owns
 * only the shell's content area. It renders no fields, no order summary and no
 * prices, because none of that exists yet and inventing it would misrepresent
 * what the screen can do.
 */
@Component({
  selector: 'app-booking-step-checkout',
  styleUrl: './booking-step-checkout.scss',
  templateUrl: './booking-step-checkout.html',
})
export class BookingStepCheckout {}

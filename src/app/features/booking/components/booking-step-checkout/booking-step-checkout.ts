import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Component, computed, inject, signal } from '@angular/core';
import { OrderRequest } from '../../../../core/models/order';
import { AuthService } from '../../../../core/services/auth.service';
import { FormField } from '../../../../shared/ui/form-field/form-field';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { BookingHoldService } from '../../booking-hold.service';
import { BookingOrderService } from '../../booking-order.service';
import { BookingStateService } from '../../booking-state.service';
import { SeatSelectionSummary } from '../seat-selection-summary/seat-selection-summary';

/**
 * Names of the form's controls. These are also the field names the API validates
 * by, which is what lets a `422` be put straight onto the control it names
 * instead of being translated.
 */
export type CheckoutField = 'fullName' | 'email' | 'mobileNumber' | 'cardNumber' | 'expiry' | 'cvv';

/**
 * Holds a control to exactly `length` digits, ignoring spaces and dashes.
 *
 * Stated on digits rather than on the characters as typed, so that a card entered
 * in one group or in fours is judged by one standard: the API accepts both
 * `4242424242424242` and `4242 4242 4242 4242` as the same card, and a rule that
 * rejected one of them for its spacing would be describing a rule the API does not
 * have.
 */
function exactlyDigits(length: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').replace(/\D/g, '').length === length ? null : { digits: true };
}

/**
 * The local message for each control, chosen from that control's own error.
 *
 * Kept as one table beside the validators rather than inlined in the template so
 * the wording and the rule it describes cannot drift apart.
 */
const MESSAGES: Record<CheckoutField, (control: AbstractControl) => string> = {
  fullName: (control) =>
    control.hasError('required') ? 'Enter your full name.' : 'Enter at least 3 characters.',
  email: (control) =>
    control.hasError('required') ? 'Enter your email address.' : 'Enter a valid email address.',
  mobileNumber: (control) =>
    control.hasError('required') ? 'Enter your mobile number.' : 'Enter a 9-digit mobile number.',
  cardNumber: (control) =>
    control.hasError('required') ? 'Enter your card number.' : 'Enter a 16-digit card number.',
  expiry: (control) =>
    control.hasError('required') ? 'Enter the expiry date.' : 'Enter the expiry as MM/YY.',
  cvv: (control) => (control.hasError('required') ? 'Enter the CVV.' : 'Enter the 3-digit CVV.'),
};

/**
 * Step 2 of the booking flow: who is buying, how they are paying, and the act of
 * paying for it.
 *
 * The buyer fields are prefilled from the authenticated visitor's own profile —
 * the name, email and mobile number they booked with — because retyping facts
 * the API already holds is the most likely way to earn a `422` about a field that
 * was never wrong.
 *
 * **Validation runs twice, for two different jobs.** The local rules exist only
 * to avoid a pointless round trip and to answer immediately; the API's rules are
 * authoritative, and its `422` messages are shown under the control each one
 * names, verbatim. A local message therefore only ever describes what the local
 * rule actually checks.
 *
 * Nothing here calls the API: {@link BookingOrderService} owns the request, and
 * {@link BookingHoldService} owns what becomes of the hold when the order cannot
 * be paid for. This component owns the form and the presentation of the outcome.
 */
@Component({
  imports: [FormField, LoadingIndicator, ReactiveFormsModule, SeatSelectionSummary],
  selector: 'app-booking-step-checkout',
  styleUrl: './booking-step-checkout.scss',
  templateUrl: './booking-step-checkout.html',
})
export class BookingStepCheckout {
  private readonly forms = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly hold = inject(BookingHoldService);
  private readonly orderService = inject(BookingOrderService);
  private readonly booking = inject(BookingStateService);

  /**
   * Whether a hold is being checked out at all.
   *
   * Step 2 exists to complete a hold, so the step and the hold are expected
   * together — an expiry returns the flow to Step 1 on its own. This is the null
   * check that keeps the layout from rendering an empty summary in the moment
   * between the hold going and the step following it back.
   */
  protected readonly hasHold = this.hold.hasHold;

  /**
   * The checkout form.
   *
   * Nothing here talks to the API: {@link BookingOrderService} owns the request.
   * These rules exist only to avoid spending a request on a value that could not
   * possibly be accepted, and to answer immediately; the API's own rules are
   * authoritative and are read straight onto these controls when it says no.
   *
   * The digit lengths are counts of digits, for the reason given on
   * {@link exactlyDigits}. Whether the digits are the *right* digits is the
   * API's call, not this form's — an over-clever local card check would reject
   * numbers the server accepts, and invent a reason it never gave.
   */
  protected readonly form = this.forms.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    mobileNumber: ['', [Validators.required, exactlyDigits(9)]],
    cardNumber: ['', [Validators.required, exactlyDigits(16)]],
    expiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
  });

  /** Per-field messages from the API, keyed by control name. */
  private readonly serverErrors = signal<Readonly<Record<string, readonly string[]>>>({});

  /** Whether an order request is in flight; the control shows its waiting state. */
  protected readonly submitting = this.orderService.submitting;

  /** Whether an order may be submitted: a hold exists and nothing is in flight. */
  protected readonly canSubmit = this.orderService.canSubmit;

  /**
   * A failure that belongs to the form rather than to the booking flow.
   *
   * Only a `422` carrying field errors does. Everything else has already sent
   * the visitor back to Step 1 through the hold service, which owns the banner
   * explaining it; showing the same sentence here as well would be noise.
   */
  protected readonly fieldFailureMessage = computed(() => {
    const failure = this.orderService.failure();

    return failure !== null && failure.kind === 'fields' ? failure.message : null;
  });

  constructor() {
    this.prefill();
  }

  /**
   * The message to show under one control: the API's if it named this field,
   * otherwise the local rule's.
   *
   * The server's message wins because it is the reason the request actually
   * failed. A local rule has not seen the request at all, so it can only be
   * guessing about a field the API has already judged.
   */
  protected errorFor(field: CheckoutField): string | null {
    const server = this.serverErrors()[field];

    if (server !== undefined && server.length > 0) {
      return server.join(' ');
    }

    return this.localErrorFor(field);
  }

  /**
   * Returns to seat selection without releasing the hold.
   *
   * The hold is deliberately kept: the visitor is changing their mind about the
   * seats, not abandoning the booking, and the API replaces the hold when they
   * submit a new selection — releasing here would only take away seats the server
   * is still holding for them.
   */
  protected backToSeats(): void {
    this.booking.showStep1();
  }

  /**
   * Validates and pays for the hold.
   *
   * Nothing is sent unless the local rules pass, so an obviously incomplete form
   * costs no request. While one is in flight the form is disabled and the control
   * is inert, and {@link BookingOrderService.canSubmit} refuses a second call —
   * which together are what stop one hold being turned into two orders.
   *
   * On `201` there is nothing left to render: recording the order closes the
   * booking dialog, because the seats are sold and the countdown has no hold left
   * to count. The reference is logged so the captured payload is visible until
   * the confirmation step replaces this with a proper receipt.
   */
  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const hold = this.hold.hold();

    if (hold === null) {
      return;
    }

    this.form.disable();
    this.serverErrors.set({});

    try {
      // On a `201` the order service has already stored the order, consumed the
      // hold and closed the booking, so the confirmation view — which renders
      // from that stored order — opens in the dialog's place. The form itself
      // has nothing left to do with the response.
      await this.orderService.submit(this.buildRequest(hold.holdId));
    } catch {
      // The order service has already routed the failure: field errors are put
      // on their controls, and a lost hold has taken the flow back to Step 1.
      // There is nothing to do here but let the visitor try again.
      this.mapServerErrors();
    } finally {
      // Re-enabled even after success: on a `201` the dialog is already closed
      // and this component is being destroyed, so re-enabling costs nothing and
      // keeps the failure path from leaving an inert form behind.
      this.form.enable();
    }
  }

  /**
   * Puts each `422` message on the control the API named it for.
   *
   * The API's keys are the same names as the controls, which is what makes this
   * a lookup rather than a translation table. Anything the API named that this
   * form does not have is simply never read by {@link errorFor}; the general
   * message still reaches the visitor through {@link fieldFailureMessage}.
   */
  private mapServerErrors(): void {
    const failure = this.orderService.failure();

    if (failure === null || failure.kind !== 'fields') {
      return;
    }

    this.serverErrors.set(failure.fields);
  }

  /**
   * Fills the buyer fields from the authenticated visitor's profile.
   *
   * Read from {@link AuthService}'s already-fetched user rather than requested
   * again: `/me` has run at startup or at login. Every profile field is `null`
   * until the profile is complete, in which case the form starts empty and the
   * visitor types their own details.
   */
  private prefill(): void {
    const user = this.auth.user();

    this.form.patchValue({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      mobileNumber: user?.mobileNumber ?? '',
    });
  }

  /**
   * The request body, with the fields normalised the way the API documents.
   *
   * The card number and expiry go as typed — the API accepts the spaces the
   * design groups them with — but the mobile number is stripped of spaces,
   * because that field is validated digit by digit and a grouped number would
   * read as a different, longer one.
   */
  private buildRequest(holdId: string): OrderRequest {
    const value = this.form.getRawValue();

    return {
      holdId,
      fullName: value.fullName.trim(),
      email: value.email.trim(),
      mobileNumber: value.mobileNumber.replace(/\s+/g, ''),
      cardNumber: value.cardNumber.trim(),
      expiry: value.expiry.trim(),
      cvv: value.cvv.trim(),
    };
  }

  /**
   * The local rule's message for one control.
   *
   * Nothing is said until the visitor has touched the field, so a form they have
   * not filled in yet is not covered in complaints the moment Step 2 opens.
   */
  private localErrorFor(field: CheckoutField): string | null {
    const control = this.form.controls[field];

    if (!(control.touched || control.dirty) || control.valid) {
      return null;
    }

    return MESSAGES[field](control);
  }
}

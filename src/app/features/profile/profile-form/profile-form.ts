import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toApiError } from '../../../core/api/api-error';
import { User } from '../../../core/models/user';
import { isAuthReplayCancellation } from '../../../core/services/auth-replay.service';
import { AuthService } from '../../../core/services/auth.service';
import { FilterOptionsService } from '../../../core/services/filter-options.service';
import { FormField } from '../../../shared/ui/form-field/form-field';
import { LoadingIndicator } from '../../../shared/ui/loading/loading-indicator';
import { ProfileService, ProfileUpdate } from '../profile.service';

/**
 * The API's field names, which are also this form's control names — that is
 * what lets a `422` be put straight onto the control it names.
 */
type ProfileField = 'fullName' | 'mobileNumber' | 'dateOfBirth' | 'preferredVenueId';

/** Fields this form also judges locally; the optional venue is the API's call. */
type LocallyValidatedField = Exclude<ProfileField, 'preferredVenueId'>;

/** Every control the API may return field-level errors for. */
const PROFILE_FIELDS = ['fullName', 'mobileNumber', 'dateOfBirth', 'preferredVenueId'] as const;

/** Minimum age the API accepts; mirrored only so obviously invalid data costs no request. */
const MIN_AGE = 12;

/**
 * Georgian mobile numbers: nine digits starting with `5`.
 *
 * Spaces are allowed in the input — `599 123 456` and `599123456` are the same
 * number, because the API strips whitespace before validating and stores nine
 * digits — so whitespace is removed before any rule is judged and is never
 * itself a reason to reject a value. Nothing beyond that is checked: rules the
 * contract does not state would invent reasons the API does not have.
 */
function georgianMobileValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '');

  if (raw.trim().length === 0) {
    return { required: true };
  }

  const digits = raw.replace(/\s+/g, '');

  if (!/^\d+$/.test(digits)) {
    return { format: true };
  }

  if (!digits.startsWith('5')) {
    return { prefix: true };
  }

  if (digits.length !== 9) {
    return { length: true };
  }

  return null;
}

/**
 * Date of birth: a real, non-future date the account holder is at least 12 years
 * old on.
 *
 * Judged purely on the `YYYY-MM-DD` strings the date input and the API speak, so
 * no local-time `Date` conversion can move a date-only value across a day
 * boundary.
 */
function dateOfBirthValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');

  if (value.length === 0) {
    return null; // `required` speaks for the empty case
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > todayIso()) {
    return { calendar: true };
  }

  return ageOn(value) < MIN_AGE ? { minAge: true } : null;
}

/** Today as a local `YYYY-MM-DD` string; comparable with a date value directly. */
function todayIso(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${today.getFullYear()}-${month}-${day}`;
}

/** Whole years between a `YYYY-MM-DD` date of birth and today, without date parsing. */
function ageOn(dateOfBirth: string): number {
  const today = new Date();
  const [birthYear, birthMonth, birthDay] = dateOfBirth.split('-').map(Number);

  const month = today.getMonth() + 1;
  const beforeBirthday = month < birthMonth || (month === birthMonth && today.getDate() < birthDay);

  return today.getFullYear() - birthYear - (beforeBirthday ? 1 : 0);
}

/**
 * The local message for each control, chosen from that control's own error.
 *
 * Kept as one table beside the validators, and worded exactly as the assignment
 * states it, so the wording and the rule it describes cannot drift apart. Every
 * message here describes only what the local rule actually checks; the API's own
 * words are shown for the field they name instead.
 */
const MESSAGES: Record<LocallyValidatedField, (control: AbstractControl) => string> = {
  fullName: (control) => {
    if (control.hasError('required')) {
      return 'Name is required';
    }

    if (control.hasError('minlength')) {
      return 'Name must be at least 3 characters';
    }

    return 'Name must not exceed 50 characters';
  },
  mobileNumber: (control) => {
    if (control.hasError('required')) {
      return 'Mobile number is required';
    }

    if (control.hasError('prefix')) {
      return 'Georgian mobile numbers must start with 5';
    }

    if (control.hasError('length')) {
      return 'Mobile number must be exactly 9 digits';
    }

    return 'Please enter a valid Georgian mobile number (9 digits starting with 5)';
  },
  dateOfBirth: (control) => {
    if (control.hasError('required')) {
      return 'Date of birth is required';
    }

    if (control.hasError('minAge')) {
      return 'You must be at least 12 years old to create an account';
    }

    return 'Please enter a valid date of birth';
  },
};

/**
 * The Personal Information form: the mutable profile fields, their validation,
 * and the single `PUT /profile` that saves them.
 *
 * **Validation runs twice, for two different jobs.** The local rules exist only
 * to avoid a pointless round trip and to answer immediately; the API's rules are
 * authoritative, and its `422` messages are shown under the control each one
 * names, verbatim. A local message therefore only ever describes what the local
 * rule actually checks.
 *
 * The form never decides what a saved profile *is*: on success the server's
 * returned user replaces the authenticated-user state in {@link AuthService} and
 * the form's own baseline is reset from those returned values — including
 * `profileComplete`, which this component never computes for itself.
 */
@Component({
  imports: [FormField, LoadingIndicator, ReactiveFormsModule],
  selector: 'app-profile-form',
  styleUrl: './profile-form.scss',
  templateUrl: './profile-form.html',
})
export class ProfileForm {
  private readonly forms = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly filterOptions = inject(FilterOptionsService);

  /**
   * The profile form. Initial values are written by {@link resetTo} from the
   * authenticated user, so the form starts pristine and Save stays disabled
   * until something actually changes.
   */
  protected readonly form = this.forms.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    // Disabled, never submitted: the API establishes email at registration.
    // The pattern still states the format rule so the control carries the same
    // strict email requirement as the auth forms, even while read-only.
    email: [
      { value: '', disabled: true },
      [Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)],
    ],
    mobileNumber: ['', [Validators.required, georgianMobileValidator]],
    dateOfBirth: ['', [Validators.required, dateOfBirthValidator]],
    preferredVenueId: [null as number | null],
  });

  /** Venue options from the cached `/filter-options`; never hardcoded here. */
  protected readonly venues = computed(() => this.filterOptions.value()?.venues ?? []);

  /** Per-field messages from a `422`, keyed by the API's own field names. */
  private readonly serverErrors = signal<Partial<Record<ProfileField, readonly string[]>>>({});

  /** Whether a `PUT /profile` is in flight; disables the save control. */
  protected readonly saving = signal(false);

  /** A submission-level failure, verbatim from the server when it sent a message. */
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    this.resetTo(this.auth.user());

    // A `422` message describes the value the server judged at that moment, so
    // it must stop failing the field the moment the visitor changes that value.
    for (const field of PROFILE_FIELDS) {
      // Widened to the shared base so the four different value types do not
      // become a union of observable signatures to subscribe through.
      const control: AbstractControl = this.form.controls[field];

      control.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.clearServerError(field));
    }
  }

  /**
   * The message to show under one control: the API's if it named this field,
   * otherwise the local rule's.
   *
   * The server's message wins because it is the reason the request actually
   * failed; when it sent several for one field they are all kept, so nothing
   * useful is discarded. Local messages stay behind the usual touched/dirty
   * gate, so an untouched form is not covered in complaints, and a submit marks
   * everything touched so a message cannot hide behind an unfocused field.
   */
  protected errorFor(field: ProfileField): string | null {
    const server = this.serverErrors()[field];

    if (server !== undefined && server.length > 0) {
      return server.join(' ');
    }

    if (field === 'preferredVenueId') {
      return null; // optional, and this form has no rule of its own for it
    }

    const control = this.form.controls[field];

    if (!(control.touched || control.dirty) || control.valid) {
      return null;
    }

    return MESSAGES[field](control);
  }

  /**
   * Validates and saves the profile.
   *
   * Nothing is sent unless the local rules pass, and while one request is in
   * flight the guard above plus the disabled control make a second click
   * impossible — one save action can never become two `PUT /profile` requests.
   */
  protected async submit(): Promise<void> {
    if (this.saving()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.serverErrors.set({});

    try {
      // The response, not the request, is what was stored: it becomes the
      // authenticated-user state and the form's new pristine baseline.
      const user = await this.profile.update(this.buildRequest());
      this.auth.applyUser(user);
      this.resetTo(user);
    } catch (error) {
      this.applyFailure(error);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * The request body, with the fields normalised the way the API documents:
   * the mobile number stripped of whitespace, the full name trimmed, and the
   * venue as its id. Email is never part of it.
   */
  private buildRequest(): ProfileUpdate {
    const value = this.form.getRawValue();

    return {
      fullName: value.fullName.trim(),
      mobileNumber: value.mobileNumber.replace(/\s+/g, ''),
      dateOfBirth: value.dateOfBirth,
      preferredVenueId: value.preferredVenueId,
    };
  }

  /**
   * Puts a failed save where it belongs: `422` field messages onto the controls
   * the API named, everything else into the banner above the form.
   *
   * Server text is never replaced — several messages for one field are kept
   * together rather than reduced to one — and the banner only appears when no
   * field was named, so a general sentence never hides a specific one.
   */
  private applyFailure(error: unknown): void {
    // The 401 recovery login was dismissed: the request never reached a server.
    if (isAuthReplayCancellation(error)) {
      this.saveError.set(error.message);
      return;
    }

    const failure = toApiError(error);
    const fieldErrors = failure.body?.errors ?? {};
    const mapped: Partial<Record<ProfileField, readonly string[]>> = {};
    let mappedAny = false;

    for (const field of PROFILE_FIELDS) {
      const messages = fieldErrors[field];
      const usable = Array.isArray(messages)
        ? messages.filter((message): message is string => typeof message === 'string' && !!message)
        : [];

      if (usable.length === 0) {
        continue;
      }

      mapped[field] = usable;
      mappedAny = true;
    }

    this.serverErrors.set(mapped);
    this.form.markAllAsTouched();

    if (!mappedAny) {
      // Verbatim server text only; invented fallbacks would hide real failures.
      this.saveError.set(failure.body?.message ?? 'Could not save your profile. Please try again.');
    }
  }

  /**
   * Fills the form from the authenticated user and resets it to pristine, which
   * is what makes Save disable itself again after a successful save. The values
   * are always the server's — including the mobile number the API stored as nine
   * digits — never the spaced representation the visitor may have typed.
   */
  private resetTo(user: User | null): void {
    this.form.reset({
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
      mobileNumber: user?.mobileNumber ?? '',
      dateOfBirth: user?.dateOfBirth ?? '',
      preferredVenueId: user?.preferredVenue?.id ?? null,
    });
  }

  /** Drops the API's message for one field once the visitor edits that field. */
  private clearServerError(field: ProfileField): void {
    this.serverErrors.update((all) => {
      if (all[field] === undefined) {
        return all;
      }

      const next = { ...all };
      delete next[field];

      return next;
    });
  }
}

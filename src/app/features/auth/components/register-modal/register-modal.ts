import { Component, ElementRef, OnDestroy, inject, output, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toApiError } from '../../../../core/api/api-error';
import { RegisterRequest } from '../../../../core/models/auth';
import { AuthService } from '../../../../core/services/auth.service';
import { FormField } from '../../../../shared/ui/form-field/form-field';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { Modal } from '../../../../shared/ui/modal/modal';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const SERVER_ERROR_FIELDS = [
  'username',
  'email',
  'password',
  'password_confirmation',
  'avatar',
] as const;

/**
 * Registration dialog content. Mounted by the future auth orchestrator inside
 * `<app-modal open>`; this component owns only the form and the register call.
 *
 * Field errors from a `422` response are mapped back onto their controls so
 * they render inside the matching `<app-form-field>`; anything without a
 * field mapping is shown verbatim in the banner at the top.
 */
@Component({
  imports: [FormField, LoadingIndicator, Modal, ReactiveFormsModule],
  selector: 'app-register-modal',
  styleUrl: './register-modal.scss',
  templateUrl: './register-modal.html',
})
export class RegisterModal implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly forms = inject(FormBuilder);

  /** Whether the dialog shell is visible. Owned by the parent orchestrator. */
  readonly open = signal(true);

  /** Forwarded when the user dismisses the dialog (X, overlay, Escape). */
  readonly closed = output<void>();

  /** The user wants the login dialog instead. */
  readonly switchToLogin = output<void>();

  protected readonly form = this.forms.group(
    {
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(3)]],
      password_confirmation: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected readonly loading = signal(false);

  /** General server message shown in the banner, or `null`. */
  protected readonly serverError = signal<string | null>(null);

  /** Accepted avatar file, or `null` when none was chosen. */
  protected readonly avatar = signal<File | null>(null);

  /** Preview URL for the accepted avatar, or `null`. */
  protected readonly avatarPreview = signal<string | null>(null);

  protected get canSubmit(): boolean {
    return !this.loading() && !this.form.pristine && this.form.valid && this.avatarError() === null;
  }

  /** Client-side or server-side avatar message, or `null`. */
  protected readonly avatarError = signal<string | null>(null);

  /**
   * The file input covering the avatar row, reached to clear its value.
   *
   * It is the control the whole row clicks through to, so removing an avatar has
   * to reset it as well as the state.
   */
  protected readonly avatarInput = viewChild.required<ElementRef<HTMLInputElement>>('avatarInput');

  /**
   * Username message, or `null`.
   *
   * `null` in both directions that matter: before the field has been engaged, and
   * the moment it satisfies its validators — so correcting the value clears the
   * message on that keystroke, with no further blur or click.
   */
  protected usernameError(): string | null {
    return fieldError(this.form.controls.username, {
      required: 'Username is required.',
      minlength: 'Username must be at least 3 characters.',
    });
  }

  /** Email message, or `null`, under the same rules as the username field. */
  protected emailError(): string | null {
    return fieldError(this.form.controls.email, {
      required: 'Email is required.',
      email: 'Enter a valid email address.',
    });
  }

  /** Password message, or `null`, under the same rules as the username field. */
  protected passwordError(): string | null {
    return fieldError(this.form.controls.password, {
      required: 'Password is required.',
      minlength: 'Password must be at least 3 characters.',
    });
  }

  /**
   * Confirmation message, or `null`.
   *
   * The mismatch is a form-level error, so it is read off the group rather than
   * the control; it still disappears the instant the two values agree.
   */
  protected passwordConfirmationError(): string | null {
    const control = this.form.controls.password_confirmation;
    const required = fieldError(control, { required: 'Please confirm your password.' });

    if (required !== null) {
      return required;
    }

    return this.form.hasError('passwordMismatch') && isEngaged(control)
      ? 'Passwords do not match.'
      : null;
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      this.rejectAvatar(input, 'Please choose a JPG, PNG or WEBP image.');
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      this.rejectAvatar(input, 'Avatar must be at most 2MB.');
      return;
    }

    this.revokePreview();
    this.avatar.set(file);
    this.avatarPreview.set(URL.createObjectURL(file));
    this.avatarError.set(null);
    input.value = '';
  }

  /**
   * Drops the chosen avatar and revokes its preview URL.
   *
   * The click is stopped and defaulted so it can never reach the file input
   * underneath: the whole avatar row is covered by an invisible `<input
   * type="file">` that turns any click on it into "browse for a file", which is
   * what used to happen instead of removing the picture.
   *
   * The input's own value is cleared too, so choosing the same file again still
   * counts as a change and reopens the preview instead of being swallowed as an
   * unchanged selection.
   */
  protected removeAvatar(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();

    this.revokePreview();
    this.avatar.set(null);
    this.avatarPreview.set(null);
    this.avatarError.set(null);

    const input = this.avatarInput().nativeElement;
    input.value = '';
  }

  protected async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid || this.avatarError() !== null) {
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    try {
      const { username, email, password, password_confirmation } = this.form.getRawValue();
      const payload: RegisterRequest = {
        username: username ?? '',
        email: email ?? '',
        password: password ?? '',
        password_confirmation: password_confirmation ?? '',
      };

      const avatar = this.avatar();
      if (avatar) {
        payload.avatar = avatar;
      }

      await this.auth.register(payload);
      this.closed.emit();
    } catch (error) {
      this.applyServerError(error);
    } finally {
      this.loading.set(false);
    }
  }

  private rejectAvatar(input: HTMLInputElement, message: string): void {
    this.revokePreview();
    this.avatar.set(null);
    this.avatarPreview.set(null);
    this.avatarError.set(message);
    input.value = '';
  }

  private revokePreview(): void {
    const preview = this.avatarPreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }

  private applyServerError(error: unknown): void {
    const apiError = toApiError(error);
    const fieldErrors = apiError.body?.errors ?? {};
    let mapped = false;

    for (const field of SERVER_ERROR_FIELDS) {
      const messages = fieldErrors[field];
      const message = Array.isArray(messages) ? messages[0] : undefined;

      if (typeof message !== 'string' || message.length === 0) {
        continue;
      }

      mapped = true;

      if (field === 'avatar') {
        this.avatarError.set(message);
        continue;
      }

      const control = this.form.get(field);
      control?.setErrors({ ...(control.errors ?? {}), server: message });
      control?.markAsTouched();
    }

    // Verbatim server text only; invented fallbacks would hide real failures.
    this.serverError.set(mapped ? null : (apiError.body?.message ?? null));
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }
}

/**
 * Whether the visitor has engaged a control yet.
 *
 * A pristine field shows nothing: flagging an untouched form as full of errors
 * would be noise, and the messages are there the moment they type and blur.
 */
function isEngaged(control: AbstractControl): boolean {
  return control.touched || control.dirty;
}

/**
 * The message for a control's *current* errors, or `null` when it has none.
 *
 * Every branch is keyed to a specific validator key, so a control that satisfies
 * its validators resolves to `null` and its message disappears on the keystroke
 * that fixed it — no fall-through "always show something" return, which is what
 * left the stale message behind. A `422` from the server outranks the local copy.
 */
function fieldError(
  control: AbstractControl,
  messages: Partial<Record<'required' | 'minlength' | 'email', string>>,
): string | null {
  if (!isEngaged(control) || control.valid) {
    return null;
  }

  if (control.hasError('server')) {
    return control.getError('server') as string;
  }

  for (const key of Object.keys(messages) as (keyof typeof messages)[]) {
    if (control.hasError(key)) {
      return messages[key] ?? null;
    }
  }

  return null;
}

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | null;
  const confirmation = control.get('password_confirmation')?.value as string | null;

  if (!password || !confirmation || password === confirmation) {
    return null;
  }

  return { passwordMismatch: true };
}

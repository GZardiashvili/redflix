import { Component, OnDestroy, inject, output, signal } from '@angular/core';
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

  /** Client-side or server-side avatar message, or `null`. */
  protected readonly avatarError = signal<string | null>(null);

  protected usernameError(): string | null {
    const control = this.form.controls.username;

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('server')) {
      return control.getError('server') as string;
    }

    if (control.hasError('required')) {
      return 'Username is required.';
    }

    return 'Username must be at least 3 characters.';
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('server')) {
      return control.getError('server') as string;
    }

    if (control.hasError('required')) {
      return 'Email is required.';
    }

    return 'Enter a valid email address.';
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('server')) {
      return control.getError('server') as string;
    }

    if (control.hasError('required')) {
      return 'Password is required.';
    }

    return 'Password must be at least 3 characters.';
  }

  protected passwordConfirmationError(): string | null {
    const control = this.form.controls.password_confirmation;

    if (!(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('server')) {
      return control.getError('server') as string;
    }

    if (control.hasError('required')) {
      return 'Please confirm your password.';
    }

    if (this.form.hasError('passwordMismatch')) {
      return 'Passwords do not match.';
    }

    return null;
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

  protected removeAvatar(): void {
    this.revokePreview();
    this.avatar.set(null);
    this.avatarPreview.set(null);
    this.avatarError.set(null);
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

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | null;
  const confirmation = control.get('password_confirmation')?.value as string | null;

  if (!password || !confirmation || password === confirmation) {
    return null;
  }

  return { passwordMismatch: true };
}

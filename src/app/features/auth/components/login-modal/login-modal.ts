import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toApiError } from '../../../../core/api/api-error';
import { LoginCredentials } from '../../../../core/models/auth';
import { AuthService } from '../../../../core/services/auth.service';
import { FormField } from '../../../../shared/ui/form-field/form-field';
import { LoadingIndicator } from '../../../../shared/ui/loading/loading-indicator';
import { Modal } from '../../../../shared/ui/modal/modal';

/**
 * Login dialog content. Mounted by the future auth orchestrator inside
 * `<app-modal open>`; this component owns only the form and the login call.
 *
 * Server text is rendered verbatim, the dialog stays open on failure and the
 * entered email is preserved because the form is never reset on error.
 */
@Component({
  imports: [FormField, LoadingIndicator, Modal, ReactiveFormsModule],
  selector: 'app-login-modal',
  styleUrl: './login-modal.scss',
  templateUrl: './login-modal.html',
})
export class LoginModal {
  private readonly auth = inject(AuthService);
  private readonly forms = inject(FormBuilder);

  /** Whether the dialog shell is visible. Owned by the parent orchestrator. */
  readonly open = signal(true);

  /** Forwarded when the user dismisses the dialog (X, overlay, Escape). */
  readonly closed = output<void>();

  /** The user wants the registration dialog instead. */
  readonly switchToRegister = output<void>();

  protected readonly form = this.forms.group({
    email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
    password: ['', [Validators.required, Validators.minLength(3)]],
  });

  protected readonly loading = signal(false);

  /** Exact server message from a failed login, or `null`. */
  protected readonly serverError = signal<string | null>(null);

  protected emailError(): string | null {
    const control = this.form.controls.email;

    if (!(control.touched || control.dirty) || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Email is required.';
    }

    return 'Please enter a valid email format.';
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;

    if (!(control.touched || control.dirty) || control.valid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Password is required.';
    }

    return 'Password must be at least 3 characters.';
  }

  protected async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.serverError.set(null);

    try {
      const credentials = this.form.getRawValue() as LoginCredentials;
      await this.auth.login(credentials);
      this.closed.emit();
    } catch (error) {
      // Verbatim server text only; invented fallbacks would hide real failures.
      this.serverError.set(toApiError(error).body?.message ?? null);
    } finally {
      this.loading.set(false);
    }
  }
}

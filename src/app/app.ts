import { Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthReplayService } from './core/services/auth-replay.service';
import { AuthService } from './core/services/auth.service';
import { LoginModal } from './features/auth/components/login-modal/login-modal';
import { RegisterModal } from './features/auth/components/register-modal/register-modal';
import { BookingModal } from './features/booking/components/booking-modal/booking-modal';
import { OrderConfirmationModal } from './features/booking/components/order-confirmation-modal/order-confirmation-modal';
import { AppHeader } from './layout/app-header/app-header';

/**
 * Application shell: header, routed content and the single application-wide
 * authentication dialog.
 *
 * The shell owns whether the login/register dialog is open. A user can open it
 * from the header, or the replay coordinator can request it after a protected
 * request returns 401; either way the modals themselves own their forms and
 * the login/register API calls.
 */
@Component({
  imports: [
    AppHeader,
    BookingModal,
    LoginModal,
    OrderConfirmationModal,
    RegisterModal,
    RouterOutlet,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly replay = inject(AuthReplayService);

  /** Whether the login dialog is currently shown. */
  protected readonly loginOpen = signal(false);

  /** Whether the registration dialog is currently shown. */
  protected readonly registerOpen = signal(false);

  protected readonly replayLoginRequested = this.replay.loginRequested;

  constructor() {
    // A protected 401 opens the same login dialog the header offers. The
    // replay coordinator stays the source of truth while its flow is active;
    // a user-opened dialog has no pending requests behind it.
    effect(() => {
      if (this.replayLoginRequested()) {
        this.registerOpen.set(false);
        this.loginOpen.set(true);
      }
    });

    // A successful login or registration releases the pending protected
    // requests (or completes a user-opened dialog with nothing pending).
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.replay.completeLogin();
      }
    });
  }

  protected openLogin(): void {
    this.registerOpen.set(false);
    this.loginOpen.set(true);
  }

  protected openRegister(): void {
    this.loginOpen.set(false);
    this.registerOpen.set(true);
  }

  protected closeAuthDialogs(): void {
    this.loginOpen.set(false);
    this.registerOpen.set(false);
  }

  protected onLoginClosed(): void {
    // A replay-triggered login resolves its pending requests through the auth
    // effect above; a dismissal without login cancels them instead.
    if (!this.auth.isAuthenticated() && this.replayLoginRequested()) {
      this.replay.cancelLogin();
    }

    this.closeAuthDialogs();
  }

  protected onRegisterClosed(): void {
    this.closeAuthDialogs();
  }
}

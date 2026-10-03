import { Component, ElementRef, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Application header: brand, primary navigation and the session-dependent
 * account area. Guests get the login/registration triggers; an authenticated
 * user gets an identity button that opens a profile/logout dropdown. The
 * dialogs themselves belong to the shell, so they are only requested here.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-header',
  styleUrl: './app-header.scss',
  templateUrl: './app-header.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class AppHeader {
  /** The user asked to log in; the application shell owns the dialog. */
  readonly loginRequested = output<void>();

  /** The user asked to register; the application shell owns the dialog. */
  readonly registerRequested = output<void>();

  protected readonly auth = inject(AuthService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the account dropdown is currently open. */
  protected readonly menuOpen = signal(false);

  /** Full name when the profile has one, username otherwise. */
  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    if (user === null) {
      return '';
    }

    return user.fullName?.trim() || user.username;
  });

  /** Single-letter avatar placeholder while the profile has no picture. */
  protected readonly initial = computed(() => this.displayName().slice(0, 1).toUpperCase());

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    void this.auth.logout();
  }

  /** Closes the dropdown when a click lands outside the header. */
  protected onDocumentClick(event: Event): void {
    const target = event.target;

    if (target instanceof Node && !this.hostRef.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }
}

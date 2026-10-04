import { Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppHeaderSearch } from './app-header-search/app-header-search';

/**
 * Application header: brand, primary navigation and the session-dependent
 * account area. Guests get the login/registration triggers; an authenticated
 * user gets a profile control that opens the designed account dropdown —
 * identity, profile completion status, My Profile and Log out. The dialogs
 * themselves belong to the shell, so they are only requested here.
 */
@Component({
  imports: [AppHeaderSearch, RouterLink],
  selector: 'app-header',
  styleUrl: './app-header.scss',
  templateUrl: './app-header.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeOnEscape()',
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

  /** Guards a second Log out click while the first logout request is running. */
  private loggingOut = false;

  /** The profile control, so Escape can return focus to what opened the menu. */
  private readonly triggerButton = viewChild<ElementRef<HTMLButtonElement>>('triggerButton');

  /** Full name when the profile has one, username otherwise. */
  protected readonly displayName = computed(() => {
    const user = this.auth.user();
    if (user === null) {
      return '';
    }

    return user.fullName?.trim() || user.username;
  });

  /**
   * First name for the header profile control. The supplied design shows only
   * the first name beside the avatar ("Meri") while the dropdown shows the
   * full name — derived here by splitting, never from a second user state.
   */
  protected readonly firstName = computed(() => {
    const name = this.displayName().trim().split(/\s+/).filter(Boolean);

    return name[0] ?? '';
  });

  /**
   * Initials for the avatar placeholders, in the design's two-letter form:
   * the first letter of the name plus the first letter of the surname ("MS"),
   * or — when the profile only has a single name — its first two characters.
   */
  protected readonly initials = computed(() => {
    const parts = this.displayName().trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    const letters =
      parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);

    return letters.toUpperCase();
  });

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /**
   * Escape closes the dropdown — the shell's existing convention — and returns
   * focus to the profile control, so the keyboard user is not left on a menu
   * that has just unmounted.
   */
  protected closeOnEscape(): void {
    if (!this.menuOpen()) {
      return;
    }

    this.closeMenu();
    this.triggerButton()?.nativeElement.focus();
  }

  /**
   * Signs out through the existing auth service and closes the dropdown.
   *
   * The guard keeps a rapid second click from starting a second logout request;
   * everything else — the API call, token removal, the header returning to its
   * guest state — stays with {@link AuthService}.
   */
  protected async logout(): Promise<void> {
    if (this.loggingOut) {
      return;
    }

    this.loggingOut = true;
    this.closeMenu();

    try {
      await this.auth.logout();
    } finally {
      this.loggingOut = false;
    }
  }

  /** Closes the dropdown when a click lands outside the header. */
  protected onDocumentClick(event: Event): void {
    const target = event.target;

    if (target instanceof Node && !this.hostRef.nativeElement.contains(target)) {
      this.closeMenu();
    }
  }
}

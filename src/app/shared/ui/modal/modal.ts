import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

let nextModalTitleId = 0;

/**
 * Reusable dialog shell: overlay, dimmed page, centred content and the generic ways of
 * closing it.
 *
 * The parent owns the state: it decides whether the dialog is open, supplies the content and
 * reacts to {@link closed}. This component deliberately does not `model()` the `open` input,
 * because a one-way `[open]` binding plus an internally written value can silently desync from
 * the parent's signal; the parent always stays the single source of truth.
 */
@Component({
  imports: [],
  selector: 'app-modal',
  styleUrl: './modal.scss',
  templateUrl: './modal.html',
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class Modal {
  /** Whether the dialog is visible. Owned by the parent feature. */
  readonly open = input.required<boolean>();

  /** Accessible name of the dialog, rendered as its heading. */
  readonly title = input.required<string>();

  /** Accessible name of the close button. */
  readonly closeLabel = input('Close');

  /**
   * Requested by the user through the close button, Escape or the overlay.
   *
   * The parent decides what happens next (usually setting its own `open` signal to `false`);
   * the dialog never navigates, resets state or calls the API.
   */
  readonly closed = output<void>();

  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  protected readonly titleId = `modal-title-${nextModalTitleId++}`;

  constructor() {
    effect((onCleanup) => {
      const dialog = this.dialog()?.nativeElement;

      if (dialog === undefined) {
        // Closed: the dialog element is gone, so there is nothing to manage.
        return;
      }

      const trigger = document.activeElement;
      dialog.focus();
      lockPageScroll();

      onCleanup(() => {
        unlockPageScroll();
        restoreFocus(trigger);
      });
    });
  }

  protected requestClose(): void {
    this.closed.emit();
  }

  protected onEscape(event: Event): void {
    if (!this.open()) {
      return;
    }

    // Keep the key press from reaching page-level Escape behaviour behind the dialog.
    event.preventDefault();
    event.stopPropagation();
    this.requestClose();
  }

  protected onOverlayClick(event: MouseEvent): void {
    // Clicks inside the dialog bubble up to the overlay, so only a click whose target *is*
    // the overlay counts as "outside".
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }
}

let openDialogCount = 0;

/** Stops the page behind the overlay from being the primary scroll surface. */
function lockPageScroll(): void {
  openDialogCount += 1;
  document.body.classList.add('modal-open');
}

/** Releases the page scroll lock only once the last dialog has closed. */
function unlockPageScroll(): void {
  openDialogCount = Math.max(0, openDialogCount - 1);

  if (openDialogCount === 0) {
    document.body.classList.remove('modal-open');
  }
}

/** Returns focus to the element that opened the dialog, when it can still receive it. */
function restoreFocus(trigger: Element | null): void {
  if (trigger instanceof HTMLElement && trigger !== document.body && trigger.isConnected) {
    trigger.focus();
  }
}

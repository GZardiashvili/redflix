import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <button type="button" class="trigger" (click)="open.set(true)">Open</button>
    <app-modal [open]="open()" title="Test dialog" (closed)="onClosed()">
      <button type="button" class="projected">Projected action</button>
    </app-modal>
  `,
})
class ModalHost {
  readonly open = signal(false);
  closedCount = 0;

  onClosed(): void {
    this.closedCount += 1;
    this.open.set(false);
  }
}

describe('Modal', () => {
  let fixture: ComponentFixture<ModalHost>;

  const host = () => fixture.nativeElement as HTMLElement;
  const overlay = () => host().querySelector<HTMLElement>('.modal__overlay');
  const dialog = () => host().querySelector<HTMLElement>('.modal__dialog');
  const closeButton = () => host().querySelector<HTMLButtonElement>('.modal__close');
  const closedCount = () => fixture.componentInstance.closedCount;

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function setOpen(value: boolean): Promise<void> {
    fixture.componentInstance.open.set(value);
    await render();
  }

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ModalHost] });
    fixture = TestBed.createComponent(ModalHost);
    await render();
  });

  it('renders projected content inside a dialog with the expected semantics', async () => {
    await setOpen(true);

    expect(host().querySelector('.projected')?.textContent).toContain('Projected action');

    const element = dialog();
    expect(element).not.toBeNull();
    expect(element?.getAttribute('role')).toBe('dialog');
    expect(element?.getAttribute('aria-modal')).toBe('true');

    const labelledBy = element?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? '')?.textContent).toContain('Test dialog');

    expect(closeButton()?.getAttribute('aria-label')).toBe('Close');
  });

  it('requests close from the close button and hides when the parent honours it', async () => {
    await setOpen(true);

    closeButton()?.click();
    await render();

    expect(closedCount()).toBe(1);
    expect(overlay()).toBeNull();
  });

  it('closes on Escape', async () => {
    await setOpen(true);

    pressEscape();
    await render();

    expect(closedCount()).toBe(1);
    expect(overlay()).toBeNull();
  });

  it('ignores Escape while closed and unrelated keys while open', async () => {
    pressEscape();
    await render();
    expect(closedCount()).toBe(0);

    await setOpen(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await render();

    expect(closedCount()).toBe(0);
    expect(overlay()).not.toBeNull();
  });

  it('closes when the overlay itself is clicked', async () => {
    await setOpen(true);

    overlay()?.click();
    await render();

    expect(closedCount()).toBe(1);
    expect(overlay()).toBeNull();
  });

  it('does not close when the dialog content is clicked', async () => {
    await setOpen(true);

    dialog()?.click();
    host().querySelector<HTMLButtonElement>('.projected')?.click();
    await render();

    expect(closedCount()).toBe(0);
    expect(overlay()).not.toBeNull();
  });

  it('moves focus into the dialog and returns it to the trigger on close', async () => {
    const trigger = host().querySelector<HTMLButtonElement>('.trigger');
    trigger?.focus();
    expect(document.activeElement).toBe(trigger);

    await setOpen(true);
    expect(document.activeElement).toBe(dialog());

    closeButton()?.click();
    await render();

    expect(document.activeElement).toBe(trigger);
  });

  it('locks page scroll while open and releases it on close', async () => {
    expect(document.body.classList.contains('modal-open')).toBe(false);

    await setOpen(true);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    await setOpen(false);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});

@Component({
  imports: [Modal],
  template: `
    <app-modal [open]="firstOpen()" title="First dialog">First body</app-modal>
    <app-modal [open]="secondOpen()" title="Second dialog">Second body</app-modal>
  `,
})
class StackedModalsHost {
  readonly firstOpen = signal(true);
  readonly secondOpen = signal(true);
}

describe('Modal (stacked dialogs)', () => {
  let fixture: ComponentFixture<StackedModalsHost>;

  const dialogs = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.modal__dialog'),
    );

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [StackedModalsHost] });
    fixture = TestBed.createComponent(StackedModalsHost);
    await render();
  });

  it('keeps the page scroll locked until the last dialog closes', async () => {
    expect(dialogs()).toHaveLength(2);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    fixture.componentInstance.firstOpen.set(false);
    await render();

    expect(dialogs()).toHaveLength(1);
    expect(document.body.classList.contains('modal-open')).toBe(true);

    fixture.componentInstance.secondOpen.set(false);
    await render();

    expect(dialogs()).toHaveLength(0);
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorState } from './error-state';

@Component({
  imports: [ErrorState],
  template: `
    <app-error-state
      [message]="message()"
      [canRetry]="canRetry()"
      (retry)="retryCount = retryCount + 1"
    />
  `,
})
class ErrorStateHost {
  readonly message = signal('Invalid credentials.');
  readonly canRetry = signal(false);
  retryCount = 0;
}

describe('ErrorState', () => {
  let fixture: ComponentFixture<ErrorStateHost>;

  const root = () => fixture.nativeElement as HTMLElement;
  const retryButton = () => root().querySelector<HTMLButtonElement>('.error-state__retry');

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [ErrorStateHost] });
    fixture = TestBed.createComponent(ErrorStateHost);
    await render();
  });

  it('renders the supplied message verbatim', () => {
    expect(root().querySelector('.error-state__message')?.textContent?.trim()).toBe(
      'Invalid credentials.',
    );
  });

  it('announces the failure', () => {
    expect(root().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('does not offer retry when the parent provides no retry action', () => {
    expect(retryButton()).toBeNull();
  });

  it('emits retry when the retry action is activated', async () => {
    fixture.componentInstance.canRetry.set(true);
    await render();

    expect(retryButton()?.textContent).toContain('Retry');

    retryButton()?.click();
    await render();

    expect(fixture.componentInstance.retryCount).toBe(1);
  });
});

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingIndicator } from './loading-indicator';

@Component({
  imports: [LoadingIndicator],
  template: `
    <app-loading-indicator />
    <app-loading-indicator label="Saving booking" size="sm" />
  `,
})
class LoadingHost {}

describe('LoadingIndicator', () => {
  let fixture: ComponentFixture<LoadingHost>;

  const root = () => fixture.nativeElement as HTMLElement;
  const indicators = () =>
    Array.from(root().querySelectorAll<HTMLElement>('app-loading-indicator'));

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [LoadingHost] });
    fixture = TestBed.createComponent(LoadingHost);
    await fixture.whenStable();
  });

  it('renders a spinner that assistive technology ignores', () => {
    const spinner = indicators()[0]?.querySelector('.loading-indicator__spinner');

    expect(spinner).not.toBeNull();
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes an accessible loading indication with the default label', () => {
    const status = indicators()[0]?.querySelector('[role="status"]');

    expect(status).not.toBeNull();
    expect(status?.textContent).toContain('Loading');
    expect(status?.querySelector('.visually-hidden')).not.toBeNull();
  });

  it('uses the supplied label and size', () => {
    const [defaultIndicator, smallIndicator] = indicators();

    expect(smallIndicator?.querySelector('[role="status"]')?.textContent).toContain(
      'Saving booking',
    );
    expect(smallIndicator?.querySelector('.loading-indicator')?.classList).toContain(
      'loading-indicator--sm',
    );
    expect(defaultIndicator?.querySelector('.loading-indicator')?.classList).not.toContain(
      'loading-indicator--sm',
    );
  });
});

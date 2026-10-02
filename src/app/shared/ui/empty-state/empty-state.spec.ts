import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state title="No sessions found" message="Try another day or venue.">
      <button type="button" class="action">Change filters</button>
    </app-empty-state>

    <app-empty-state title="No tickets yet" />
  `,
})
class EmptyStateHost {}

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyStateHost>;

  const root = () => fixture.nativeElement as HTMLElement;
  const states = () => Array.from(root().querySelectorAll<HTMLElement>('app-empty-state'));

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [EmptyStateHost] });
    fixture = TestBed.createComponent(EmptyStateHost);
    await fixture.whenStable();
  });

  it('renders the supplied title, message and projected action content', () => {
    const [withAction] = states();

    expect(withAction?.querySelector('.empty-state__title')?.textContent).toContain(
      'No sessions found',
    );
    expect(withAction?.querySelector('.empty-state__message')?.textContent).toContain(
      'Try another day or venue.',
    );

    const action = withAction?.querySelector<HTMLButtonElement>('.action');
    expect(action?.textContent).toContain('Change filters');
  });

  it('omits the message when the feature supplies none', () => {
    const withoutMessage = states()[1];

    expect(withoutMessage?.querySelector('.empty-state__title')?.textContent).toContain(
      'No tickets yet',
    );
    expect(withoutMessage?.querySelector('.empty-state__message')).toBeNull();
  });
});

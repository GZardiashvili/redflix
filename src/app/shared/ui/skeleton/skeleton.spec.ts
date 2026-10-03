import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Skeleton } from './skeleton';

@Component({
  imports: [Skeleton],
  template: `
    <app-skeleton />
    <app-skeleton variant="text" />
    <app-skeleton variant="avatar" />
    <app-skeleton label="Loading movies" />
  `,
})
class SkeletonHost {}

describe('Skeleton', () => {
  let fixture: ComponentFixture<SkeletonHost>;

  const root = () => fixture.nativeElement as HTMLElement;
  const skeletons = () => Array.from(root().querySelectorAll<HTMLElement>('app-skeleton'));
  const block = (index: number) => skeletons()[index]?.querySelector('.skeleton');

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [SkeletonHost] });
    fixture = TestBed.createComponent(SkeletonHost);
    await fixture.whenStable();
  });

  it('renders a placeholder block by default', () => {
    expect(block(0)).not.toBeNull();
  });

  it('applies the requested shape variant', () => {
    expect(block(1)?.classList).toContain('skeleton--text');
    expect(block(2)?.classList).toContain('skeleton--avatar');
    expect(block(0)?.classList).not.toContain('skeleton--text');
  });

  it('stays hidden from assistive technology by default', () => {
    const [implicit] = skeletons();

    expect(implicit?.getAttribute('aria-hidden')).toBe('true');
    expect(implicit?.getAttribute('role')).toBeNull();
  });

  it('exposes an accessible loading indication when labelled', () => {
    const labelled = skeletons()[3];

    expect(block(3)).not.toBeNull();
    expect(labelled?.getAttribute('role')).toBe('status');
    expect(labelled?.getAttribute('aria-label')).toBe('Loading movies');
    expect(labelled?.getAttribute('aria-hidden')).toBeNull();
  });
});

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScrollFade } from './scroll-fade.directive';

/** Stand-in for a card row: the directive only ever reads its own element. */
@Component({
  imports: [ScrollFade],
  template: `<div appScrollFade class="row"></div>`,
})
class RowHost {}

describe('ScrollFade', () => {
  let fixture: ComponentFixture<RowHost>;
  let row: HTMLElement;

  /** Scroll geometry of the row. jsdom lays nothing out, so it is pinned here. */
  function geometry(scrollLeft: number, scrollWidth: number, clientWidth: number): void {
    for (const [name, value] of Object.entries({ scrollLeft, scrollWidth, clientWidth })) {
      Object.defineProperty(row, name, { configurable: true, value });
    }
  }

  /** The two mask insets the row's `mask-image` reads. */
  const fades = () => [
    row.style.getPropertyValue('--row-fade-left'),
    row.style.getPropertyValue('--row-fade-right'),
  ];

  async function scrollTo(
    scrollLeft: number,
    scrollWidth = 1_000,
    clientWidth = 400,
  ): Promise<void> {
    geometry(scrollLeft, scrollWidth, clientWidth);
    row.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
  }

  /** `[left, right]`: an open edge fades, a reached one does not. */
  const [leftClosed, rightOpen] = ['0%', '7%'];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RowHost] }).compileComponents();

    fixture = TestBed.createComponent(RowHost);
    fixture.detectChanges();
    row = (fixture.nativeElement as HTMLElement).querySelector('.row')!;
    await fixture.whenStable();
  });

  it('fades only the overflowing right edge at the start of the row', async () => {
    geometry(0, 1_000, 400);
    row.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    expect(fades()).toEqual([leftClosed, rightOpen]);
  });

  it('fades the left edge as soon as anything is hidden behind it', async () => {
    await scrollTo(6);

    expect(fades()).toEqual([rightOpen, rightOpen]);
  });

  it('keeps the left edge faded at the end and closes the right one', async () => {
    await scrollTo(600);

    expect(fades()).toEqual([rightOpen, leftClosed]);
  });

  it('treats a row that settled a few pixels short of the end as reached', async () => {
    // A touch fling routinely stops inside the tolerance band; an edge fade left
    // showing there would read as content still hidden when there is none.
    await scrollTo(597);

    expect(fades()).toEqual([rightOpen, leftClosed]);
  });

  it('leaves both edges hard on a row that does not overflow', async () => {
    await scrollTo(0, 400, 400);

    expect(fades()).toEqual([leftClosed, leftClosed]);
  });
});

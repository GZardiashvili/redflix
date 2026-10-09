import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HorizontalWheelScroll } from './horizontal-wheel-scroll.directive';

/** Stand-in for a carousel row: the directive only ever reads its own element. */
@Component({
  imports: [HorizontalWheelScroll],
  template: `<div class="row" appHorizontalWheelScroll></div>`,
})
class RowHost {}

describe('HorizontalWheelScroll', () => {
  let fixture: ComponentFixture<RowHost>;
  let row: HTMLElement;

  /** Dispatches a cancelable wheel event; jsdom has no `deltaY` unless told. */
  function wheel(deltaY: number, deltaX = 0): WheelEvent {
    const event = new WheelEvent('wheel', { deltaY, deltaX, cancelable: true });
    row.dispatchEvent(event);
    return event;
  }

  /**
   * Pins the row's scroll geometry. jsdom lays nothing out, so the directive
   * would otherwise see no overflow and refuse to scroll; `scrollLeft` stays
   * writable because the directive adds to it.
   */
  function geometry(scrollLeft = 0, scrollWidth = 1_000, clientWidth = 400): void {
    for (const [name, value] of Object.entries({ scrollLeft, scrollWidth, clientWidth })) {
      Object.defineProperty(row, name, { configurable: true, writable: true, value });
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RowHost] }).compileComponents();

    fixture = TestBed.createComponent(RowHost);
    fixture.detectChanges();
    row = (fixture.nativeElement as HTMLElement).querySelector('.row')!;
  });

  it('turns a vertical wheel into horizontal scroll and stops the page scroll', () => {
    geometry(0);

    const event = wheel(60);

    expect(row.scrollLeft).toBe(60);
    expect(event.defaultPrevented).toBe(true);
  });

  it('scrolls the other way for a negative deltaY', () => {
    geometry(120);

    wheel(-40);

    expect(row.scrollLeft).toBe(80);
  });

  it('leaves a trackpad horizontal swipe (deltaX only) untouched', () => {
    geometry(0);

    const event = wheel(0, 50);

    expect(row.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not hijack the wheel on a row that does not overflow', () => {
    geometry(0, 400, 400);

    const event = wheel(60);

    expect(row.scrollLeft).toBe(0);
    expect(event.defaultPrevented).toBe(false);
  });
});

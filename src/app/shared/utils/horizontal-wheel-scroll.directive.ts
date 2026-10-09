import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Maps a vertical mouse wheel to horizontal scrolling on an overflowing row.
 *
 * Trackpads already emit horizontal gestures directly, but a standard mouse only
 * ever produces a vertical `deltaY`. On a carousel whose native scrollbar is
 * hidden, that leaves a mouse user nothing to grab, so this directive turns the
 * vertical wheel into `scrollLeft` and stops the page behind the row from
 * scrolling at the same time.
 *
 * Attached to the scrolling element itself, so it moves the exact row the
 * visitor is hovering and changes nothing about its contents. It only takes over
 * the wheel while the row can actually scroll horizontally: a row that fits (the
 * expanded Coming Soon grid, or a short row) leaves the wheel to the page, so the
 * visitor is never trapped.
 */
@Directive({
  selector: '[appHorizontalWheelScroll]',
  host: {
    '(wheel)': 'onWheel($event)',
  },
})
export class HorizontalWheelScroll {
  private readonly element = inject(ElementRef).nativeElement as HTMLElement;

  protected onWheel(event: WheelEvent): void {
    // A pure horizontal gesture is a trackpad already swiping the row: the
    // browser scrolls it natively, so leave it entirely alone — and never
    // preventDefault, which would break that native swipe.
    if (event.deltaY === 0) {
      return;
    }

    // Only take over the wheel while the row can actually scroll horizontally.
    // A row that fits would otherwise swallow the page scroll for no gain.
    const maxScroll = this.element.scrollWidth - this.element.clientWidth;
    if (maxScroll <= 0) {
      return;
    }

    this.element.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}

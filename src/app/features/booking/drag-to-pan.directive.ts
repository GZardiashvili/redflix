import { DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Pixels of pointer travel before a press counts as a pan rather than a click.
 *
 * A seat is 52px wide and a visitor's hand is never perfectly still, so without
 * a threshold every click on a seat would also have been a tiny drag.
 */
const DRAG_THRESHOLD = 5;

/** How many pixels the map travels per pixel of pointer movement. */
const PAN_FACTOR = 1.5;

/**
 * Turns a fixed viewport into a pannable canvas, the way a map view behaves:
 * press, drag, and the content travels with the pointer instead of a scrollbar
 * doing the moving.
 *
 * Attached to the element that scrolls — the seat map's viewport — so it adjusts
 * the scroll position the visitor is actually looking at. Both axes move, and the
 * native scrollbars are hidden by the host's stylesheet, which is what sells the
 * illusion that the canvas itself is being dragged.
 *
 * The press is only a pan when it moves: a press that stays inside
 * {@link DRAG_THRESHOLD} is left completely alone, and one that travelled further
 * has its trailing `click` swallowed in the capture phase — otherwise releasing
 * on the seat the drag started from would select it, which is precisely the
 * control the visitor was panning past rather than choosing.
 *
 * Nothing here is seat-map specific: it is a plain directive on any scrollable
 * element, and it decides nothing about what is inside.
 */
@Directive({
  selector: '[appDragToPan]',
  host: {
    '[class.is-panning]': 'isPanning()',
    '(mousedown)': 'startPan($event)',
    '(mousemove)': 'movePan($event)',
    '(mouseup)': 'endPan()',
    '(mouseleave)': 'endPan()',
  },
})
export class DragToPan {
  /** Whether the visitor is holding the pointer down and dragging the map. */
  protected readonly isPanning = signal(false);

  private readonly element = inject(ElementRef).nativeElement as HTMLElement;

  /** The press origin and the scroll position it started from. */
  private startX = 0;
  private startY = 0;
  private startLeft = 0;
  private startTop = 0;

  /** Whether this press travelled far enough to be a pan. */
  private moved = false;

  /** Whether the click that follows this press must be swallowed. */
  private suppressClick = false;

  private readonly swallowDraggedClick = (event: MouseEvent): void => {
    if (!this.suppressClick) {
      return;
    }

    this.suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  constructor() {
    this.element.addEventListener('click', this.swallowDraggedClick, true);

    inject(DestroyRef).onDestroy(() => {
      this.element.removeEventListener('click', this.swallowDraggedClick, true);
    });
  }

  /** Begins a pan from the press origin; any button but the left one is ignored. */
  protected startPan(event: MouseEvent): void {
    if (event.button !== 0) {
      return;
    }

    this.isPanning.set(true);
    this.moved = false;
    this.suppressClick = false;
    this.startX = event.pageX;
    this.startY = event.pageY;
    this.startLeft = this.element.scrollLeft;
    this.startTop = this.element.scrollTop;
  }

  /**
   * Moves the viewport by the distance travelled since the press, amplified by
   * {@link PAN_FACTOR} so the map keeps up with the pointer instead of lagging
   * a hand's width behind it.
   *
   * The scroll position is always measured from the press's own starting point
   * rather than accumulated: a value derived from the original offsets cannot
   * drift, and it reads the same on the first moved event and the last.
   */
  protected movePan(event: MouseEvent): void {
    if (!this.isPanning()) {
      return;
    }

    const walkX = (event.pageX - this.startX) * PAN_FACTOR;
    const walkY = (event.pageY - this.startY) * PAN_FACTOR;

    this.moved ||=
      Math.abs(event.pageX - this.startX) > DRAG_THRESHOLD ||
      Math.abs(event.pageY - this.startY) > DRAG_THRESHOLD;

    this.element.scrollLeft = this.startLeft - walkX;
    this.element.scrollTop = this.startTop - walkY;
  }

  /** Ends the pan, recording whether the click it is about to produce is a drag's. */
  protected endPan(): void {
    if (!this.isPanning()) {
      return;
    }

    this.isPanning.set(false);
    this.suppressClick = this.moved;
  }
}

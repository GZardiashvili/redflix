import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DragToPan } from './drag-to-pan.directive';

/** Stand-in for the seat map viewport: the directive only ever touches its own element. */
@Component({
  imports: [DragToPan],
  template: `
    <div class="viewport" appDragToPan>
      <button class="seat" type="button" (click)="clicks = clicks + 1">C4</button>
    </div>
  `,
})
class ViewportHost {
  clicks = 0;
}

/** Pixels of travel the tests use; well past the directive's drag threshold. */
const DRAG = 40;

describe('DragToPan', () => {
  let fixture: ComponentFixture<ViewportHost>;
  let viewport: HTMLElement;
  let seat: HTMLButtonElement;

  /** Dispatches a MouseEvent on the target; jsdom derives `pageX` from `clientX`. */
  function fire(target: EventTarget, type: string, x: number, y: number, button = 0): void {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, button, clientX: x, clientY: y }));
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ViewportHost] }).compileComponents();

    fixture = TestBed.createComponent(ViewportHost);
    fixture.detectChanges();

    viewport = (fixture.nativeElement as HTMLElement).querySelector('.viewport')!;
    seat = viewport.querySelector('.seat')!;

    // jsdom lays nothing out, so the viewport starts part-way into its content:
    // a pan then has something to move away from, like a scrolled-open hall.
    viewport.scrollLeft = 200;
    viewport.scrollTop = 100;
  });

  it('drags the viewport by the distance travelled, on both axes', () => {
    fire(viewport, 'mousedown', 100, 100);
    fire(viewport, 'mousemove', 100 + DRAG, 100 + DRAG / 2);

    expect(viewport.scrollLeft).toBe(200 - DRAG * 1.5);
    expect(viewport.scrollTop).toBe(100 - (DRAG / 2) * 1.5);
  });

  it('holds the grabbing state only while the pointer is down', () => {
    fire(viewport, 'mousedown', 100, 100);
    fixture.detectChanges();
    expect(viewport.classList.contains('is-panning')).toBe(true);

    fire(viewport, 'mouseup', 100, 100);
    fixture.detectChanges();
    expect(viewport.classList.contains('is-panning')).toBe(false);
  });

  it('stops panning when the pointer leaves, without another drag resuming it', () => {
    fire(viewport, 'mousedown', 100, 100);
    fire(viewport, 'mousemove', 100 + DRAG, 100);
    const travelled = viewport.scrollLeft;

    fire(viewport, 'mouseleave', 0, 0);
    fire(viewport, 'mousemove', 400, 400);

    expect(viewport.scrollLeft).toBe(travelled);
  });

  it('swallows the click a drag leaves behind, so no seat under it is chosen', () => {
    fire(seat, 'mousedown', 100, 100);
    fire(viewport, 'mousemove', 100 + DRAG, 100);
    fire(viewport, 'mouseup', 100 + DRAG, 100);
    seat.click();

    expect(fixture.componentInstance.clicks).toBe(0);
  });

  it('lets a press that never travelled click through untouched', () => {
    fire(seat, 'mousedown', 100, 100);
    fire(seat, 'mouseup', 100, 100);
    seat.click();

    expect(fixture.componentInstance.clicks).toBe(1);
    expect(viewport.scrollLeft).toBe(200);
  });

  it('ignores every button but the left one', () => {
    fire(viewport, 'mousedown', 100, 100, 1);
    fire(viewport, 'mousemove', 100 + DRAG, 100 + DRAG);

    expect(viewport.scrollLeft).toBe(200);
    expect(viewport.classList.contains('is-panning')).toBe(false);
  });
});

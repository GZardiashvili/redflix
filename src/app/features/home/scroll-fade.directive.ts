import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * Slack, in pixels, before an edge counts as reached.
 *
 * A row settles on a fractional offset and a touch fling routinely stops a few
 * pixels short of the end, so an exact comparison would strand a shadow next to
 * an edge that is already visually reached.
 */
const EDGE_TOLERANCE = 5;

/** Width of the dissolve at an open edge, as a percentage of the row. */
const FADE = '7%';

/**
 * Drives the edge fade of a horizontally scrolling row from its live scroll
 * position.
 *
 * The fade itself belongs to the stylesheet: it reads the `--row-fade-left` and
 * `--row-fade-right` custom properties this sets, so the row's `mask-image`
 * stays a stylesheet concern and nothing has to know how the dissolve looks.
 *
 * The fade therefore tracks position instead of the scroll *range*: the right
 * edge is open for the whole time the row overflows and closes only at the end,
 * while the left edge opens as soon as anything is hidden to the left. A scroll
 * timeline cannot express the first state — it has no way to know whether the
 * content overflows at all — which is why the offsets are measured here.
 *
 * Attached to the scrolling element itself, so it measures what the visitor
 * actually scrolls.
 */
@Directive({
  selector: '[appScrollFade]',
  host: {
    '[style.--row-fade-left]': 'fadeLeft()',
    '[style.--row-fade-right]': 'fadeRight()',
  },
})
export class ScrollFade {
  /** Left mask inset: `0%` at the start of the row, the fade width once cards are hidden there. */
  protected readonly fadeLeft = signal('0%');

  /** Right mask inset: the fade width while the row overflows, `0%` at its end. */
  protected readonly fadeRight = signal('0%');

  private readonly element = inject(ElementRef).nativeElement as HTMLElement;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const element = this.element;

    // Rows are measured after layout: the row and its cards have no width until
    // then, and the cards only arrive once their section's request settles.
    afterNextRender(() => {
      const update = () => this.update();

      element.addEventListener('scroll', update, { passive: true });

      // Re-measure whenever the row or its content changes size, so a row that
      // starts out not overflowing picks its fade up as soon as it does. Guarded
      // because the test DOM has no ResizeObserver; there the scroll listener is
      // the only thing that moves the fade, which is all these tests exercise.
      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
      resize?.observe(element);
      for (const card of element.children) {
        resize?.observe(card);
      }

      this.destroyRef.onDestroy(() => {
        element.removeEventListener('scroll', update);
        resize?.disconnect();
      });

      update();
    });
  }

  private update(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.element;
    const maxScroll = scrollWidth - clientWidth;

    this.fadeLeft.set(scrollLeft > EDGE_TOLERANCE ? FADE : '0%');

    // A row that does not overflow has nothing hidden behind either edge, so it
    // keeps its hard edges instead of fading content that is already fully shown.
    this.fadeRight.set(
      maxScroll > EDGE_TOLERANCE && scrollLeft < maxScroll - EDGE_TOLERANCE ? FADE : '0%',
    );
  }
}

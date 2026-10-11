import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Seat } from '../../../../../core/models/seat';
import { SeatComponent } from './seat';

/** Host that renders one seat and records every activation. */
@Component({
  imports: [SeatComponent],
  template: `<app-seat [seat]="seat()" [selected]="selected()" (toggled)="toggled = $event" />`,
})
class SeatHost {
  readonly seat = signal<Seat>(available());
  readonly selected = signal(false);
  toggled: Seat | null = null;
}

function seat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: 1,
    code: 'C4',
    label: '4',
    state: 'available',
    aisleAfter: false,
    isMine: false,
    ...overrides,
  };
}

function available(): Seat {
  return seat();
}

describe('SeatComponent', () => {
  let fixture: ComponentFixture<SeatHost>;

  const host = () => fixture.nativeElement as HTMLElement;
  const button = () => host().querySelector<HTMLButtonElement>('button.seat');
  const tile = () => host().querySelector<HTMLElement>('.seat');

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(SeatHost);
    await render();
  });

  it('renders an available seat as an interactive button', () => {
    expect(button()).not.toBeNull();
    expect(button()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders a sold seat as an inert tile with no button', () => {
    fixture.componentInstance.seat.set(seat({ state: 'sold' }));
    return render().then(() => {
      expect(button()).toBeNull();
      expect(tile()?.classList).toContain('seat--sold');
    });
  });

  it('renders a third-party held seat as inert', () => {
    fixture.componentInstance.seat.set(seat({ state: 'held', isMine: false }));
    return render().then(() => {
      expect(button()).toBeNull();
      expect(tile()?.classList).toContain('seat--held');
    });
  });

  it('renders a held seat that is mine as an interactive selected button', () => {
    fixture.componentInstance.seat.set(seat({ state: 'held', isMine: true }));
    fixture.componentInstance.selected.set(true);
    return render().then(() => {
      expect(button()).not.toBeNull();
      expect(button()?.classList).toContain('seat--selected');
      expect(button()?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('renders a held seat that is mine but deselected as interactive yet unselected', () => {
    // After a refresh the seat keeps isMine, but dropping it from the summary
    // removes it from the selection without refetching the map: the tile must
    // fall back to the unselected look while staying clickable.
    fixture.componentInstance.seat.set(seat({ state: 'held', isMine: true }));
    fixture.componentInstance.selected.set(false);
    return render().then(() => {
      expect(button()).not.toBeNull();
      expect(button()?.classList).not.toContain('seat--selected');
      expect(button()?.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('emits a toggle when a held seat that is mine is clicked', () => {
    fixture.componentInstance.seat.set(seat({ state: 'held', isMine: true }));
    fixture.componentInstance.selected.set(true);
    return render().then(() => {
      button()?.click();
      expect(fixture.componentInstance.toggled?.code).toBe('C4');
    });
  });

  it('does not emit a toggle when a third-party held seat tile is clicked', () => {
    fixture.componentInstance.seat.set(seat({ state: 'held', isMine: false }));
    return render().then(() => {
      tile()?.click();
      expect(fixture.componentInstance.toggled).toBeNull();
    });
  });

  it('emits a toggle when an available seat is clicked to deselect it', () => {
    fixture.componentInstance.selected.set(true);
    return render().then(() => {
      button()?.click();
      expect(fixture.componentInstance.toggled?.code).toBe('C4');
    });
  });
});

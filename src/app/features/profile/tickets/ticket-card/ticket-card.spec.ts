import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Order, OrderSession } from '../../../../core/models/order';
import { TicketCard } from './ticket-card';

const SESSION_START = '2026-10-12T18:30:00.000Z';

const VENUE = { id: 1, slug: 'galleria', name: 'Galleria Tbilisi', city: 'Tbilisi' } as const;

const session: OrderSession = {
  id: 3,
  startsAt: SESSION_START,
  date: '2026-10-12',
  time: '18:30',
  timeBand: 'evening',
  price: 20,
  seatsLeft: 40,
  isSoldOut: false,
  hall: { id: 2, name: 'B', venue: VENUE },
  venue: VENUE,
  format: { id: 1, slug: 'standard', name: 'Standard', priceUplift: 0 },
  language: { id: 1, slug: 'georgian-dub', name: 'Georgian Dub', code: 'GEO' },
  movie: {
    id: 1,
    slug: 'dune-part-three',
    title: 'Dune: Part Three',
    kind: 'movie',
    runtimeMinutes: 165,
    posterUrl: 'https://example.test/poster.jpg',
    backdropUrl: 'https://example.test/backdrop.jpg',
    releaseDate: '2026-09-01',
    isComingSoon: false,
    isNotified: false,
    isFeatured: true,
    fromPrice: 20,
    ageRating: { code: 'PG', minAge: 0, description: 'Suitable for all ages.' },
  },
};

/** One order; each state under test overrides only what defines that state. */
function anOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 900,
    reference: 'KX-ABC123',
    status: 'paid',
    totalPrice: 40,
    paidAt: '2026-10-01T10:00:00.000Z',
    refundedAt: null,
    isUpcoming: true,
    isRefundable: true,
    cardLastFour: '4242',
    contact: { fullName: 'Nino Beridze', email: 'nino@example.com', mobileNumber: '5555123456' },
    session,
    tickets: [{ id: 1, seatCode: 'C4', ticketType: { slug: 'adult', name: 'Adult' }, price: 20 }],
    ...overrides,
  };
}

@Component({
  imports: [TicketCard],
  template: `<app-ticket-card [order]="order()" [showRefund]="showRefund()" />`,
})
class TicketCardHost {
  readonly order = input.required<Order>();
  readonly showRefund = input(false);
}

describe('TicketCard refund states', () => {
  let fixture: ComponentFixture<TicketCardHost>;
  let card: HTMLElement;

  /** Renders one order the way My Tickets does: `showRefund` marks the upcoming tab. */
  function render(order: Order, showRefund: boolean): HTMLElement {
    fixture.componentRef.setInput('order', order);
    fixture.componentRef.setInput('showRefund', showRefund);
    fixture.detectChanges();

    return (fixture.nativeElement as HTMLElement).querySelector('.ticket-card')!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TicketCardHost] }).compileComponents();

    // No first render here: `order` is required, so the card is only drawn by
    // `render`, which sets the inputs it is being judged on first.
    fixture = TestBed.createComponent(TicketCardHost);
  });

  const refundButton = () => card.querySelector<HTMLButtonElement>('.ticket-card__refund');
  const note = () => card.querySelector('.ticket-card__refund-note')?.textContent?.trim() ?? null;
  const refunded = () => card.querySelector('.ticket-card__refunded');

  it('offers an enabled Refund button with the cutoff of an upcoming refundable order', () => {
    card = render(anOrder({ isRefundable: true }), true);

    expect(refundButton()?.disabled).toBe(false);
    // startsAt minus two hours: 18:30 → 16:30 on the same day.
    expect(note()).toMatch(/^Refundable until 16:30,/);
  });

  it('disables Refund and states the closed window on an upcoming locked order', () => {
    card = render(anOrder({ isRefundable: false }), true);

    expect(refundButton()?.disabled).toBe(true);
    expect(note()).toBe('Refunds close 2 hours before the session.');
  });

  it('keeps a structurally disabled Refund button on an attended past order', () => {
    card = render(anOrder({ isUpcoming: false, isRefundable: false }), false);

    expect(refundButton()?.hasAttribute('disabled')).toBe(true);
    expect(refundButton()?.disabled).toBe(true);
    expect(note()).toBeNull();
    expect(refunded()).toBeNull();
  });

  it('replaces the control with a Refunded label once the order was refunded', () => {
    card = render(
      anOrder({ isUpcoming: false, isRefundable: false, refundedAt: '2026-10-05T09:00:00.000Z' }),
      false,
    );

    expect(refundButton()).toBeNull();
    expect(refunded()?.textContent?.trim()).toBe('Refunded');
  });
});

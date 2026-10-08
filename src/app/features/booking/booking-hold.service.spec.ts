import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  API_BASE_URL,
  holdUrl,
  sessionHoldsUrl,
  sessionSeatsUrl,
} from '../../core/config/api.config';
import { FilterOptions } from '../../core/models/filter-options';
import { Hold } from '../../core/models/hold';
import { SessionSeatMap } from '../../core/models/seat';
import { FilterOptionsService } from '../../core/services/filter-options.service';
import { BookingContext } from './booking-context';
import { BookingHoldService } from './booking-hold.service';
import { BookingStateService } from './booking-state.service';
import { SeatSelectionService } from './seat-selection.service';

/** The key the hold id is persisted under; part of the task's contract. */
const STORAGE_KEY = 'kinoxii_active_hold';

const SESSION_ID = 7;
const HOLD_ID = '11111111-2222-3333-4444-555555555555';

const context: BookingContext = {
  sessionId: SESSION_ID,
  startsAt: '2026-10-12T18:30:00.000Z',
  date: '2026-10-12',
  time: '18:30',
  price: 20,
  venueName: 'Galleria Tbilisi',
  hallName: 'B',
  movieSlug: 'dune-part-three',
  movieTitle: 'Dune: Part Three',
  ageRatingMinAge: 12,
  formatName: 'Standard',
  languageName: 'Georgian Dub',
  languageCode: 'GEO',
};

/** A hold far enough in the future that the countdown never treats it as expired. */
function aHold(overrides: Partial<Hold> = {}): Hold {
  return {
    holdId: HOLD_ID,
    sessionId: SESSION_ID,
    expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(),
    secondsRemaining: 480,
    isLive: true,
    subtotal: 20,
    seats: [{ seatId: 11, code: 'C4', ticketType: { slug: 'adult', name: 'Adult' }, price: 20 }],
    ...overrides,
  };
}

const FILTER_OPTIONS: FilterOptions = {
  venues: [],
  formats: [],
  languages: [],
  timeBands: [],
  sorts: [],
  ticketTypes: [
    { id: 1, slug: 'adult', name: 'Adult', priceRatio: 1, note: null, blockedFromRatingAge: null },
  ],
  ageRatings: [],
  maxSeatsPerOrder: 3,
  holdMinutes: 8,
};

const MAP: SessionSeatMap = {
  sessionId: SESSION_ID,
  hall: { id: 1, name: 'B' },
  sections: [{ name: 'Stalls', rows: [] }],
};

/** The one seat every test holds: same id, code and ticket type as {@link aHold}. */
const SEAT = {
  id: 11,
  code: 'C4',
  label: '4',
  state: 'available',
  aisleAfter: false,
  isMine: false,
} as const;

describe('BookingHoldService persistence', () => {
  let hold: BookingHoldService;
  let booking: BookingStateService;
  let selection: SeatSelectionService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    hold = TestBed.inject(BookingHoldService);
    booking = TestBed.inject(BookingStateService);
    selection = TestBed.inject(SeatSelectionService);
    httpMock = TestBed.inject(HttpTestingController);

    // Selection resolves ticket types from the configuration, so the restore
    // assertions below need the real one rather than an empty list.
    const loading = TestBed.inject(FilterOptionsService).load();
    httpMock.expectOne(`${API_BASE_URL}/filter-options`).flush({ data: FILTER_OPTIONS });
    await loading;
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  /** Opens the flow, flushing the effects that opening schedules — seat map included. */
  function openBooking(): void {
    booking.startBooking(context);
    TestBed.flushEffects();
    httpMock.expectOne(sessionSeatsUrl(SESSION_ID)).flush({ data: MAP });
  }

  /** Picks the one seat and asks the server to hold it, answering with a hold. */
  function submitHold(): void {
    selection.toggle(SEAT);
    hold.submit();

    httpMock.expectOne(sessionHoldsUrl(SESSION_ID)).flush({ data: aHold() });
  }

  it('stores the hold id on a 201 and clears it when the hold is released', () => {
    openBooking();
    submitHold();

    expect(localStorage.getItem(STORAGE_KEY)).toBe(HOLD_ID);
    expect(hold.hold()?.holdId).toBe(HOLD_ID);
    expect(booking.isStep2()).toBe(true);

    hold.release();
    httpMock.expectOne(holdUrl(HOLD_ID)).flush(null, { status: 204, statusText: 'No Content' });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(hold.hold()).toBeNull();
  });

  it('clears the stored id once the order has been paid for', () => {
    openBooking();
    submitHold();

    hold.complete();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(hold.hold()).toBeNull();
  });

  it('reads a stored hold back on open and resumes it on Step 2', () => {
    localStorage.setItem(STORAGE_KEY, HOLD_ID);

    openBooking();

    const request = httpMock.expectOne(holdUrl(HOLD_ID));
    expect(request.request.method).toBe('GET');
    request.flush({ data: aHold() });

    expect(hold.hold()?.holdId).toBe(HOLD_ID);
    expect(booking.isStep2()).toBe(true);
    expect(selection.lines().map((line) => line.code)).toEqual(['C4']);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(HOLD_ID);
  });

  it('drops the stored id when the server reports the hold is no longer live', () => {
    localStorage.setItem(STORAGE_KEY, HOLD_ID);

    openBooking();
    httpMock.expectOne(holdUrl(HOLD_ID)).flush({ data: aHold({ isLive: false }) });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(hold.hold()).toBeNull();
    expect(booking.isStep1()).toBe(true);
  });

  it('drops the stored id when the API refuses it', () => {
    localStorage.setItem(STORAGE_KEY, HOLD_ID);

    openBooking();
    httpMock
      .expectOne(holdUrl(HOLD_ID))
      .flush({ message: 'Not found.' }, { status: 404, statusText: 'Not Found' });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(hold.hold()).toBeNull();
    expect(booking.isStep1()).toBe(true);
  });

  it('keeps the stored id when the request never reached the server', () => {
    localStorage.setItem(STORAGE_KEY, HOLD_ID);

    openBooking();
    httpMock.expectOne(holdUrl(HOLD_ID)).error(new ProgressEvent('error'));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(HOLD_ID);
    expect(hold.hold()).toBeNull();
  });
});

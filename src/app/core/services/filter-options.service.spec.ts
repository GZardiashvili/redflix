import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { FilterOptions } from '../models/filter-options';
import { FilterOptionsService } from './filter-options.service';

const FILTER_OPTIONS_URL = `${API_BASE_URL}/filter-options`;

const filterOptions: FilterOptions = {
  venues: [
    {
      id: 1,
      slug: 'galleria',
      name: 'Galleria Tbilisi',
      city: 'Tbilisi',
      formats: [{ id: 1, slug: 'standard', name: 'Standard', priceUplift: 0 }],
    },
  ],
  formats: [{ id: 1, slug: 'standard', name: 'Standard', priceUplift: 0 }],
  languages: [{ id: 1, slug: 'georgian-dub', name: 'Georgian Dub' }],
  timeBands: [{ id: 'morning', label: 'Morning (before 12:00)' }],
  sorts: [{ id: 'time_asc', label: 'Showtime: earliest first' }],
  ticketTypes: [
    {
      id: 1,
      slug: 'adult',
      name: 'Adult',
      priceRatio: 1,
      note: null,
      blockedFromRatingAge: null,
    },
  ],
  ageRatings: [{ code: 'G', minAge: 0, description: 'Suitable for all ages.' }],
  maxSeatsPerOrder: 3,
  holdMinutes: 8,
};

describe('FilterOptionsService', () => {
  let service: FilterOptionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(FilterOptionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests filter options and shares the cached value with every consumer', async () => {
    const first = service.load();
    const second = service.load();

    expect(service.value()).toBeNull();

    const request = httpMock.expectOne(FILTER_OPTIONS_URL);
    expect(request.request.method).toBe('GET');
    request.flush({ data: filterOptions });

    await Promise.all([first, second]);

    expect(service.value()).toEqual(filterOptions);
    expect(service.error()).toBeNull();
    httpMock.expectNone(FILTER_OPTIONS_URL);
  });

  it('keeps the server message when the request fails', async () => {
    const loading = service.load();

    httpMock
      .expectOne(FILTER_OPTIONS_URL)
      .flush({ message: 'Not found.' }, { status: 404, statusText: 'Not Found' });

    await loading;

    expect(service.value()).toBeNull();
    expect(service.error()).toEqual({ status: 404, body: { message: 'Not found.' } });
  });

  it('keeps validation errors from the server', async () => {
    const loading = service.load();

    httpMock
      .expectOne(FILTER_OPTIONS_URL)
      .flush(
        { message: 'The given data was invalid.', errors: { slug: ['The slug is invalid.'] } },
        { status: 422, statusText: 'Unprocessable Content' },
      );

    await loading;

    expect(service.error()?.status).toBe(422);
    expect(service.error()?.body?.errors).toEqual({ slug: ['The slug is invalid.'] });
  });
});

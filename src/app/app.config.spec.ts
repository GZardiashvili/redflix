import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './core/config/api.config';
import { FilterOptionsService } from './core/services/filter-options.service';
import { appConfig } from './app.config';

const FILTER_OPTIONS_URL = `${API_BASE_URL}/filter-options`;

describe('application startup', () => {
  it('requests /filter-options once during bootstrap', async () => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });

    const httpMock = TestBed.inject(HttpTestingController);
    const initStatus = TestBed.inject(ApplicationInitStatus);

    const request = httpMock.expectOne(FILTER_OPTIONS_URL);
    expect(request.request.method).toBe('GET');

    // This test only covers the startup wiring; the full payload shape is covered by the
    // FilterOptionsService spec.
    request.flush({ data: { maxSeatsPerOrder: 3, holdMinutes: 8 } });

    await initStatus.donePromise;

    expect(TestBed.inject(FilterOptionsService).value()?.holdMinutes).toBe(8);
    httpMock.verify();
  });
});

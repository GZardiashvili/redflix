import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './core/config/api.config';
import { User } from './core/models/user';
import { AuthService } from './core/services/auth.service';
import { FilterOptionsService } from './core/services/filter-options.service';
import { appConfig } from './app.config';

const FILTER_OPTIONS_URL = `${API_BASE_URL}/filter-options`;
const LOGIN_URL = `${API_BASE_URL}/login`;
const ME_URL = `${API_BASE_URL}/me`;

const storedUser: User = {
  id: 7,
  username: 'cinephile',
  email: 'cinephile@example.com',
  avatar: null,
  fullName: 'Nino Beridze',
  mobileNumber: null,
  dateOfBirth: null,
  age: 30,
  preferredVenue: null,
  profileComplete: true,
};

const filterOptionsPayload = { data: { maxSeatsPerOrder: 3, holdMinutes: 8 } };

/** Starts the real application configuration with the HTTP backend replaced by the test one. */
function startApplication(): HttpTestingController {
  TestBed.configureTestingModule({
    providers: [...appConfig.providers, provideHttpClientTesting()],
  });

  return TestBed.inject(HttpTestingController);
}

describe('application startup', () => {
  beforeEach(() => localStorage.clear());

  it('requests /filter-options once during bootstrap and stays a guest without a token', async () => {
    const httpMock = startApplication();
    const initStatus = TestBed.inject(ApplicationInitStatus);

    const request = httpMock.expectOne(FILTER_OPTIONS_URL);
    expect(request.request.method).toBe('GET');

    // This test only covers the startup wiring; the full payload shape is covered by the
    // FilterOptionsService spec.
    request.flush(filterOptionsPayload);

    await initStatus.donePromise;

    expect(TestBed.inject(FilterOptionsService).value()?.holdMinutes).toBe(8);
    httpMock.expectNone(ME_URL);
    httpMock.verify();
  });

  it('restores a stored session through /me during bootstrap', async () => {
    // Sign in through the real service so a token is persisted, then start a fresh session.
    const loginMock = startApplication();
    const loginPromise = TestBed.inject(AuthService).login({
      email: storedUser.email,
      password: 'secret',
    });

    loginMock.expectOne(LOGIN_URL).flush({ data: { user: storedUser, token: 'startup-token' } });
    await loginPromise;

    TestBed.resetTestingModule();

    const httpMock = startApplication();
    const initStatus = TestBed.inject(ApplicationInitStatus);

    httpMock.expectOne(FILTER_OPTIONS_URL).flush(filterOptionsPayload);

    const meRequest = httpMock.expectOne(ME_URL);
    expect(meRequest.request.method).toBe('GET');
    expect(meRequest.request.headers.get('Authorization')).toBe('Bearer startup-token');
    meRequest.flush({ data: storedUser });

    await initStatus.donePromise;

    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()).toEqual(storedUser);
    httpMock.verify();
  });
});

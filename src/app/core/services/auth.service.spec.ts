import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { User } from '../models/user';
import { AuthService } from './auth.service';

const LOGIN_URL = `${API_BASE_URL}/login`;
const REGISTER_URL = `${API_BASE_URL}/register`;
const LOGOUT_URL = `${API_BASE_URL}/logout`;
const ME_URL = `${API_BASE_URL}/me`;

const CREDENTIALS = { email: 'cinephile@example.com', password: 'secret' };

const completeUser: User = {
  id: 7,
  username: 'cinephile',
  email: 'cinephile@example.com',
  avatar: null,
  fullName: 'Nino Beridze',
  mobileNumber: '+995555123456',
  dateOfBirth: '1995-04-12',
  age: 30,
  preferredVenue: null,
  profileComplete: true,
};

const incompleteUser: User = {
  id: 8,
  username: 'newcomer',
  email: 'newcomer@example.com',
  avatar: null,
  fullName: null,
  mobileNumber: null,
  dateOfBirth: null,
  age: null,
  preferredVenue: null,
  profileComplete: false,
};

interface AuthTestContext {
  service: AuthService;
  httpMock: HttpTestingController;
}

function createContext(): AuthTestContext {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });

  return {
    service: TestBed.inject(AuthService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

/** Logs in through the API so the token is persisted, returning the context used for it. */
async function signIn(token = 'token-1', user: User = completeUser): Promise<AuthTestContext> {
  const context = createContext();
  const loginPromise = context.service.login(CREDENTIALS);

  context.httpMock.expectOne(LOGIN_URL).flush({ data: { user, token } });
  await loginPromise;

  return context;
}

/** Persists a token and drops the application instance, simulating a browser refresh. */
async function persistToken(token: string): Promise<void> {
  await signIn(token);
  TestBed.resetTestingModule();
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('stores the token and the authenticated user on login', async () => {
    const { service, httpMock } = createContext();
    const loginPromise = service.login(CREDENTIALS);

    const request = httpMock.expectOne(LOGIN_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(CREDENTIALS);
    request.flush({ data: { user: completeUser, token: 'token-1' } });

    await expect(loginPromise).resolves.toEqual(completeUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(completeUser);
    expect(service.token()).toBe('token-1');
    httpMock.verify();
  });

  it('propagates the API error on failed login without authenticating', async () => {
    const { service, httpMock } = createContext();
    const loginPromise = service.login(CREDENTIALS);

    httpMock
      .expectOne(LOGIN_URL)
      .flush({ message: 'Invalid credentials.' }, { status: 401, statusText: 'Unauthorized' });

    await expect(loginPromise).rejects.toEqual({
      status: 401,
      body: { message: 'Invalid credentials.' },
    });
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
  });

  it('registers with the exact multipart field names and signs the user in', async () => {
    const { service, httpMock } = createContext();
    const avatar = new File(['avatar'], 'me.png', { type: 'image/png' });
    const registerPromise = service.register({
      username: 'newcomer',
      email: 'newcomer@example.com',
      password: 'secret',
      password_confirmation: 'secret',
      avatar,
    });

    const request = httpMock.expectOne(REGISTER_URL);
    expect(request.request.method).toBe('POST');
    // The backend must add Content-Type itself so it can include the multipart boundary.
    expect(request.request.headers.has('Content-Type')).toBe(false);

    const body = request.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('username')).toBe('newcomer');
    expect(body.get('email')).toBe('newcomer@example.com');
    expect(body.get('password')).toBe('secret');
    expect(body.get('password_confirmation')).toBe('secret');
    expect(body.get('avatar')).toBe(avatar);

    request.flush(
      { data: { user: incompleteUser, token: 'token-2' } },
      { status: 201, statusText: 'Created' },
    );

    await expect(registerPromise).resolves.toEqual(incompleteUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.profileComplete).toBe(false);
    expect(service.token()).toBe('token-2');
  });

  it('omits the avatar field when no avatar is provided', async () => {
    const { service, httpMock } = createContext();
    const registerPromise = service.register({
      username: 'newcomer',
      email: 'newcomer@example.com',
      password: 'secret',
      password_confirmation: 'secret',
    });

    const request = httpMock.expectOne(REGISTER_URL);
    const body = request.request.body as FormData;
    expect(body.has('avatar')).toBe(false);
    expect(body.get('password_confirmation')).toBe('secret');

    request.flush({ data: { user: incompleteUser, token: 'token-3' } });
    await registerPromise;
  });

  it('restores the persisted token in a new application instance', async () => {
    await persistToken('token-persisted');

    const { service, httpMock } = createContext();
    expect(service.token()).toBe('token-persisted');
    // The user is never the persisted state: it always comes from the API.
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);

    const restoring = service.restoreSession();
    httpMock.expectOne(ME_URL).flush({ data: completeUser });
    await restoring;

    expect(service.user()).toEqual(completeUser);
  });

  it('revokes the token through the API and clears the session on logout', async () => {
    const { service, httpMock } = await signIn('token-4');
    expect(service.isAuthenticated()).toBe(true);

    const logoutPromise = service.logout();
    const request = httpMock.expectOne(LOGOUT_URL);
    expect(request.request.method).toBe('POST');
    // The token is still available while the revoke request is in flight.
    expect(service.token()).toBe('token-4');

    request.flush(null, { status: 204, statusText: 'No Content' });
    await logoutPromise;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
    httpMock.verify();
  });

  it('clears the session even when logout fails', async () => {
    const { service, httpMock } = await signIn('token-5');

    const logoutPromise = service.logout();
    httpMock
      .expectOne(LOGOUT_URL)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });
    await logoutPromise;

    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
    expect(service.error()).toEqual({ status: 401, body: { message: 'Unauthenticated.' } });
  });

  it('does not call the API on logout without a token', async () => {
    const { service, httpMock } = createContext();

    await service.logout();

    httpMock.expectNone(LOGOUT_URL);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('does not request /me on startup without a stored token', async () => {
    const { service, httpMock } = createContext();

    await service.restoreSession();

    httpMock.expectNone(ME_URL);
    expect(service.initializing()).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
  });

  it('restores the user through /me on startup when a token is stored', async () => {
    await persistToken('token-6');

    const { service, httpMock } = createContext();
    const restoring = service.restoreSession();
    expect(service.initializing()).toBe(true);

    const request = httpMock.expectOne(ME_URL);
    expect(request.request.method).toBe('GET');
    request.flush({ data: completeUser });

    await restoring;
    expect(service.initializing()).toBe(false);
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()).toEqual(completeUser);
    expect(service.error()).toBeNull();
  });

  it('clears a stale token when /me responds with 401', async () => {
    await persistToken('stale-token');

    const { service, httpMock } = createContext();
    const restoring = service.restoreSession();
    httpMock
      .expectOne(ME_URL)
      .flush({ message: 'Unauthenticated.' }, { status: 401, statusText: 'Unauthorized' });

    await restoring;
    expect(service.isAuthenticated()).toBe(false);
    expect(service.user()).toBeNull();
    expect(service.token()).toBeNull();
    // A stale token is handled, not surfaced as an application error.
    expect(service.error()).toBeNull();

    TestBed.resetTestingModule();

    const next = createContext();
    await next.service.restoreSession();
    next.httpMock.expectNone(ME_URL);
    expect(next.service.token()).toBeNull();
  });

  it('keeps the token and records the failure when /me fails for another reason', async () => {
    await persistToken('token-kept');

    const { service, httpMock } = createContext();
    const restoring = service.restoreSession();
    httpMock
      .expectOne(ME_URL)
      .flush({ message: 'Server error.' }, { status: 500, statusText: 'Internal Server Error' });

    await expect(restoring).resolves.toBeUndefined();
    expect(service.isAuthenticated()).toBe(false);
    // A transient failure must not sign the visitor out.
    expect(service.token()).toBe('token-kept');
    expect(service.error()).toEqual({ status: 500, body: { message: 'Server error.' } });
  });
});

import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { User } from '../models/user';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const LOGIN_URL = `${API_BASE_URL}/login`;
const REGISTER_URL = `${API_BASE_URL}/register`;
const ME_URL = `${API_BASE_URL}/me`;

const user: User = {
  id: 7,
  username: 'cinephile',
  email: 'cinephile@example.com',
  avatar: null,
  fullName: 'Nino Beridze',
  mobileNumber: null,
  dateOfBirth: null,
  age: null,
  preferredVenue: null,
  profileComplete: true,
};

interface InterceptorTestContext {
  http: HttpClient;
  auth: AuthService;
  httpMock: HttpTestingController;
}

function createContext(): InterceptorTestContext {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
  });

  return {
    http: TestBed.inject(HttpClient),
    auth: TestBed.inject(AuthService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

/** Signs in through the service so a bearer token is available to the interceptor. */
async function signIn(context: InterceptorTestContext, token: string): Promise<void> {
  const loginPromise = context.auth.login({ email: 'cinephile@example.com', password: 'secret' });

  context.httpMock.expectOne(LOGIN_URL).flush({ data: { user, token } });
  await loginPromise;
}

describe('authInterceptor', () => {
  beforeEach(() => localStorage.clear());

  it('adds the bearer token to authenticated requests', async () => {
    const context = createContext();
    await signIn(context, 'bearer-token');

    const response = firstValueFrom(context.http.get(ME_URL));
    const request = context.httpMock.expectOne(ME_URL);
    expect(request.request.headers.get('Authorization')).toBe('Bearer bearer-token');

    request.flush({ data: user });
    await response;
  });

  it('leaves requests untouched when no token is stored', async () => {
    const context = createContext();

    const response = firstValueFrom(context.http.get(ME_URL));
    const request = context.httpMock.expectOne(ME_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({ data: user });
    await response;
  });

  it('does not attach an existing token to login', async () => {
    const context = createContext();
    await signIn(context, 'stale-token');

    const loginPromise = context.auth.login({ email: 'cinephile@example.com', password: 'secret' });
    const request = context.httpMock.expectOne(LOGIN_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({ data: { user, token: 'fresh-token' } });
    await loginPromise;
  });

  it('does not attach an existing token to register', async () => {
    const context = createContext();
    await signIn(context, 'stale-token');

    const registerPromise = context.auth.register({
      username: 'newcomer',
      email: 'newcomer@example.com',
      password: 'secret',
      password_confirmation: 'secret',
    });

    const request = context.httpMock.expectOne(REGISTER_URL);
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({ data: { user, token: 'fresh-token' } });
    await registerPromise;
  });

  it('preserves the headers of the original request', async () => {
    const context = createContext();
    await signIn(context, 'bearer-token');

    const response = firstValueFrom(context.http.get(ME_URL, { headers: { 'X-Trace-Id': 'abc' } }));
    const request = context.httpMock.expectOne(ME_URL);
    expect(request.request.headers.get('Authorization')).toBe('Bearer bearer-token');
    expect(request.request.headers.get('X-Trace-Id')).toBe('abc');

    request.flush({ data: user });
    await response;
  });
});

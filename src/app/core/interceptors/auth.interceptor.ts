import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, switchMap, throwError } from 'rxjs';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import {
  AUTH_REPLAYED,
  AuthReplayService,
  authReplayCancelled,
} from '../services/auth-replay.service';
import { AuthService } from '../services/auth.service';

/**
 * Authentication endpoints that are reachable as a guest, so a token left over from an
 * earlier session is never sent along with them.
 */
const PUBLIC_AUTH_URLS = new Set([apiUrl(API_ENDPOINTS.login), apiUrl(API_ENDPOINTS.register)]);

/**
 * Requests whose 401 keeps the Task 03 startup semantics instead of opening the
 * login recovery flow: session restoration is not an interrupted user action.
 */
const NO_REPLAY_URLS = new Set([apiUrl(API_ENDPOINTS.me)]);

/**
 * Attaches `Authorization: Bearer <token>` to authenticated requests and replays
 * protected requests once after a 401-driven login.
 *
 * Requests without a token are passed through untouched rather than sent with an obsolete
 * header, and no other header is added or modified. Replay coordination (pending
 * requests, the single login flow, modal triggering) lives in
 * {@link AuthReplayService}; the interceptor only detects the 401 and resends
 * the original `HttpRequest` through the pipeline after login succeeds.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (PUBLIC_AUTH_URLS.has(request.url)) {
    return next(request);
  }

  const auth = inject(AuthService);
  const replay = inject(AuthReplayService);
  const token = auth.token();

  if (token === null) {
    return next(request);
  }

  return next(withBearer(request, token)).pipe(
    catchError((error: unknown) => handleProtectedFailure(error, request, next, auth, replay)),
  );
};

function withBearer<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function handleProtectedFailure<T>(
  error: unknown,
  request: HttpRequest<T>,
  next: HttpHandlerFn,
  auth: AuthService,
  replay: AuthReplayService,
): Observable<HttpEvent<T>> {
  if (!isReplayableFailure(error, request)) {
    return throwError(() => error);
  }

  // The token just proved invalid: stop treating the user as authenticated
  // before the recovery login begins.
  auth.sessionExpired();

  return replay
    .waitForLogin()
    .pipe(switchMap(() => replay.replay(request, next, auth) as Observable<HttpEvent<T>>));
}

function isReplayableFailure<T>(error: unknown, request: HttpRequest<T>): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    !request.context.get(AUTH_REPLAYED) &&
    !NO_REPLAY_URLS.has(request.url)
  );
}

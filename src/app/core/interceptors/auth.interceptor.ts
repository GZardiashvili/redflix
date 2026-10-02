import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import { AuthService } from '../services/auth.service';

/**
 * Authentication endpoints that are reachable as a guest, so a token left over from an
 * earlier session is never sent along with them.
 */
const PUBLIC_AUTH_URLS = new Set([apiUrl(API_ENDPOINTS.login), apiUrl(API_ENDPOINTS.register)]);

/**
 * Attaches `Authorization: Bearer <token>` to authenticated requests.
 *
 * Requests without a token are passed through untouched rather than sent with an obsolete
 * header, and no other header is added or modified. Error and UI handling stay out of the
 * interceptor.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (PUBLIC_AUTH_URLS.has(request.url)) {
    return next(request);
  }

  const token = inject(AuthService).token();

  if (token === null) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};

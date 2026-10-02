import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiError, toApiError } from '../api/api-error';
import { ApiResponse } from '../api/api-response';
import { API_ENDPOINTS, apiUrl } from '../config/api.config';
import { AuthSession, LoginCredentials, RegisterRequest } from '../models/auth';
import { User } from '../models/user';

/**
 * Storage key of the persisted authentication token. Owned by this service only; no other
 * layer should know how the session survives a refresh.
 */
const TOKEN_STORAGE_KEY = 'redflix.auth.token';

/**
 * Application-wide authentication state and the only place that talks to the authentication
 * endpoints.
 *
 * Components consume {@link user}, {@link isAuthenticated} and {@link initializing} and never
 * touch the token or the storage key. The stored token is the persisted credential; the
 * {@link User} always comes from the API (`/me`), never from storage.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly userState = signal<User | null>(null);
  private readonly tokenState = signal<string | null>(readStoredToken());
  private readonly initializingState = signal(false);
  private readonly failure = signal<ApiError | null>(null);

  /** Current authenticated user, or `null` while the visitor is a guest. */
  readonly user = this.userState.asReadonly();

  /**
   * Whether an authenticated user is present. Stays `false` while {@link initializing} is
   * `true`, even when a token is stored, until `/me` confirms the session.
   */
  readonly isAuthenticated = computed(() => this.userState() !== null);

  /** Whether a stored token is currently being exchanged for a user through `/me`. */
  readonly initializing = this.initializingState.asReadonly();

  /**
   * Session failure kept for later global error handling, or `null`.
   *
   * A `401` from `/me` is not an error here: it means the stored token was stale and the
   * visitor is simply a guest.
   */
  readonly error = this.failure.asReadonly();

  /**
   * Current bearer token, for the authentication interceptor only.
   *
   * Feature components must not read this: they decide what to render from
   * {@link isAuthenticated}, {@link user} and {@link initializing}.
   */
  readonly token = this.tokenState.asReadonly();

  /**
   * Authenticates with the API, persists the returned token and stores the user.
   *
   * Throws the normalised {@link ApiError} on failure so the future login UI can render the
   * server message; no UI is driven from here.
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const session = await this.postSession(API_ENDPOINTS.login, credentials);
    this.applySession(session);

    return session.user;
  }

  /**
   * Registers through the API and signs the new user in immediately, exactly like
   * {@link login}. The `profileComplete: false` state of the response is preserved as-is.
   */
  async register(request: RegisterRequest): Promise<User> {
    const session = await this.postSession(API_ENDPOINTS.register, buildRegisterBody(request));
    this.applySession(session);

    return session.user;
  }

  /**
   * Revokes the current token through the API and always clears the local session, even when
   * the request fails, so the UI can never stay authenticated on a broken logout.
   */
  async logout(): Promise<void> {
    if (this.tokenState() !== null) {
      try {
        await firstValueFrom(this.http.post<void>(apiUrl(API_ENDPOINTS.logout), null));
      } catch (error) {
        this.failure.set(toApiError(error));
      }
    }

    this.clearSession();
  }

  /**
   * Restores the session on application startup.
   *
   * Without a stored token nothing is requested and the visitor stays a guest. With a token,
   * `/me` provides the authoritative user. Never throws: bootstrap must not be blocked by a
   * failing or unreachable API.
   */
  async restoreSession(): Promise<void> {
    if (this.tokenState() === null) {
      return;
    }

    this.initializingState.set(true);

    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<User>>(apiUrl(API_ENDPOINTS.me)),
      );

      this.userState.set(response.data);
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.status === 401) {
        // Stale or revoked token: drop it and continue as a guest.
        this.clearSession();
      } else {
        // Transient failure: keep the token so a later retry can still succeed.
        this.failure.set(apiError);
      }
    } finally {
      this.initializingState.set(false);
    }
  }

  private async postSession(
    endpoint: typeof API_ENDPOINTS.login | typeof API_ENDPOINTS.register,
    body: unknown,
  ): Promise<AuthSession> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<AuthSession>>(apiUrl(endpoint), body),
      );

      return response.data;
    } catch (error) {
      throw toApiError(error);
    }
  }

  private applySession(session: AuthSession): void {
    storeToken(session.token);
    this.tokenState.set(session.token);
    this.userState.set(session.user);
    this.failure.set(null);
  }

  private clearSession(): void {
    removeStoredToken();
    this.tokenState.set(null);
    this.userState.set(null);
  }
}

/**
 * Builds the multipart body with the exact field names of the API contract.
 *
 * `Content-Type` is deliberately not set: the HTTP backend must add it itself so it can
 * include the multipart boundary.
 */
function buildRegisterBody(request: RegisterRequest): FormData {
  const body = new FormData();
  body.append('username', request.username);
  body.append('email', request.email);
  body.append('password', request.password);
  body.append('password_confirmation', request.password_confirmation);

  if (request.avatar) {
    body.append('avatar', request.avatar);
  }

  return body;
}

function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function storeToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

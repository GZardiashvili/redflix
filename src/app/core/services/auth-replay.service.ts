import { HttpContextToken, HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { Service, computed, signal } from '@angular/core';
import { Observable, Subject, first, switchMap, takeUntil, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Marks a request that already went through the 401 replay flow once, so a
 * second 401 from the retried request propagates normally instead of
 * reopening the login modal forever.
 */
export const AUTH_REPLAYED = new HttpContextToken(() => false);

/**
 * Error terminating pending protected requests when the user dismisses the
 * replay-triggered login without authenticating. Features may branch on the
 * `replayed` flag: `false` means cancellation, `true` means the retried
 * request itself failed.
 */
export interface AuthReplayError {
  readonly name: 'AuthReplayError';
  readonly message: string;
  readonly replayed: boolean;
}

/**
 * Coordinates the 401 → login → replay-once flow for protected requests.
 *
 * The interceptor detects the 401 and clears the stale session, this service
 * opens exactly one login recovery flow no matter how many requests fail at
 * once, and the application shell renders the login modal while
 * {@link loginRequested} is `true`. Request replay itself lives in the
 * interceptor so the original `HttpRequest` (method, URL, params, body,
 * headers, options) is resent unchanged through the pipeline.
 *
 * Only `AuthService` owns authentication state and token storage; this
 * service never touches `localStorage` or the storage key.
 */
@Service()
export class AuthReplayService {
  /** Whether the shell should show the replay-triggered login modal. */
  private readonly loginRequestedState = signal(false);

  /** Whether the shell should show the replay-triggered login modal. */
  readonly loginRequested = this.loginRequestedState.asReadonly();

  /** Whether at least one protected request is waiting behind the login flow. */
  readonly hasPendingRequests = computed(() => this.pendingCount() > 0);

  private readonly pendingCount = signal(0);
  private readonly loginCompleted = new Subject<void>();
  private readonly flowCancelled = new Subject<void>();

  /**
   * Starts (or joins) the single login recovery flow and waits for it.
   *
   * Resolves once the user authenticates, or rejects with an
   * {@link AuthReplayError} when the flow is cancelled. Concurrent callers
   * share the same flow: the shell opens one modal and a successful login
   * releases every waiter.
   */
  waitForLogin(): Observable<void> {
    this.pendingCount.update((count) => count + 1);
    this.loginRequestedState.set(true);

    // Cancellation completes the gate without a value; map that completion to
    // the cancellation error so callers never hang and never see an
    // EmptyError from `first()`.
    return this.loginCompleted.pipe(
      first(),
      takeUntil(
        this.flowCancelled.pipe(
          first(),
          switchMap(() => throwError(() => authReplayCancelled())),
        ),
      ),
    );
  }

  /**
   * Releases every pending request after a successful login so the interceptor
   * can replay them with the newly issued token.
   */
  completeLogin(): void {
    this.loginCompleted.next();
    this.resetFlow();
  }

  /**
   * Cancels the recovery flow after the user dismisses the login modal.
   *
   * Pending requests reject with an {@link AuthReplayError} instead of hanging
   * forever, and the modal is not reopened for the same failures.
   */
  cancelLogin(): void {
    this.flowCancelled.next();
    this.resetFlow();
  }

  /**
   * Replays a failed request once with the current bearer token and marks the
   * clone with {@link AUTH_REPLAYED} so a second 401 cannot loop back here.
   */
  replay(
    failed: HttpRequest<unknown>,
    next: HttpHandlerFn,
    auth: AuthService,
  ): Observable<HttpEvent<unknown>> {
    const token = auth.token();
    const replayed = failed.clone({
      // Drop the stale header, then attach the fresh token directly: the
      // replayed request re-enters the handler chain at this interceptor, so
      // re-running the whole interceptor stack for it is not guaranteed.
      headers: failed.headers.delete('Authorization'),
      context: failed.context.set(AUTH_REPLAYED, true),
      ...(token === null ? {} : { setHeaders: { Authorization: `Bearer ${token}` } }),
    });

    return next(replayed);
  }

  private resetFlow(): void {
    this.pendingCount.set(0);
    this.loginRequestedState.set(false);
  }
}

/** Creates the cancellation error for pending requests. Exported for tests. */
export function authReplayCancelled(): AuthReplayError {
  return {
    name: 'AuthReplayError',
    message: 'Authentication is required to complete this action.',
    replayed: false,
  };
}

/** Whether a failure came from replay cancellation rather than the server. */
export function isAuthReplayCancellation(error: unknown): error is AuthReplayError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as AuthReplayError).name === 'AuthReplayError'
  );
}

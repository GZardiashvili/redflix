import { HttpErrorResponse } from '@angular/common/http';

/**
 * Error body documented by the Kino XII API.
 *
 * * generic failure: `{ "message": "..." }`
 * * validation failure (422): `{ "message": "The given data was invalid.", "errors": { "field": ["..."] } }`
 * * `contested` is documented for later `409` responses but its shape is not specified yet,
 *   so it is passed through untouched for the feature that needs it.
 */
export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string[]>;
  contested?: unknown;
}

/**
 * Normalised HTTP failure.
 *
 * `status` is the HTTP status code, or `0` when the request never reached the server
 * (the code Angular uses for network and CORS failures).
 * `body` is the parsed server body, or `null` when the response did not match the documented
 * error shape. Server messages are preserved as-is and never replaced with frontend text.
 */
export interface ApiError {
  status: number;
  body: ApiErrorBody | null;
}

/**
 * Converts a thrown value into an {@link ApiError} without losing server information.
 */
export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, body: null };
  }

  return { status: error.status, body: parseApiErrorBody(error.error) };
}

function parseApiErrorBody(value: unknown): ApiErrorBody | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const body = value as ApiErrorBody;
  return typeof body.message === 'string' ? body : null;
}

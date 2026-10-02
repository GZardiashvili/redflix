import { User } from './user';

/** Credentials sent to `POST /login`. */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Multipart payload for `POST /register`.
 *
 * Property names intentionally match the API contract field for field, including the
 * snake_case `password_confirmation`, so the request body needs no translation.
 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirmation: string;
  /** JPG, JPEG, PNG or WEBP, at most 2MB. Validation belongs to the registration UI. */
  avatar?: File;
}

/** Successful authentication payload returned by `POST /login` and `POST /register`. */
export interface AuthSession {
  user: User;
  token: string;
}

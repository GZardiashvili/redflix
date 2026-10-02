import { Venue } from './filter-options';

/**
 * The authenticated Kino XII user, exactly as the API returns it.
 *
 * `GET /me` is the authoritative source of this object. Note that the API sends `null` for
 * every profile field while `profileComplete` is `false`, which is the state a freshly
 * registered user is in.
 */
export interface User {
  id: number;
  username: string;
  email: string;
  avatar: string | null;
  fullName: string | null;
  mobileNumber: string | null;
  dateOfBirth: string | null;
  /** Server-derived age; `null` until the profile is complete. */
  age: number | null;
  preferredVenue: Venue | null;
  profileComplete: boolean;
}

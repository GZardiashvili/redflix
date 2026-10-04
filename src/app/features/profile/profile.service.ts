import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toApiError } from '../../core/api/api-error';
import { ApiResponse } from '../../core/api/api-response';
import { API_ENDPOINTS, apiUrl } from '../../core/config/api.config';
import { User } from '../../core/models/user';

/**
 * The mutable profile fields `PUT /profile` accepts.
 *
 * Email is deliberately absent: it is established at registration and this
 * endpoint does not change it. `preferredVenueId` is `null` when the visitor has
 * no preference, and the field is then left out of the request entirely — it is
 * optional in the API contract, and a value the API never receives cannot be
 * rejected.
 */
export interface ProfileUpdate {
  fullName: string;
  /** Nine digits starting with `5`, whitespace already removed. */
  mobileNumber: string;
  /** Date-only `YYYY-MM-DD`, exactly as the API returned it. */
  dateOfBirth: string;
  preferredVenueId: number | null;
}

/**
 * Profile feature API access. The page never builds raw requests: this service
 * owns `PUT /profile`, and the feature's own components own the form that feeds
 * it. Authentication state stays in {@link AuthService} — the successful
 * response is handed back to the page, which writes it there.
 */
@Service()
export class ProfileService {
  private readonly http = inject(HttpClient);

  /**
   * Updates the authenticated user's profile and resolves with the user the
   * server stored — the authoritative object for every profile field, for the
   * derived `age` and for `profileComplete`.
   *
   * The body is `multipart/form-data` because the API contract says so, built
   * from `FormData`. `Content-Type` is deliberately never set: the browser must
   * add it itself so the multipart boundary is included. Failures are thrown as
   * the normalised `ApiError`, so a `422` keeps its field-level `errors` for the
   * form to map.
   */
  async update(profile: ProfileUpdate): Promise<User> {
    try {
      const response = await firstValueFrom(
        this.http.put<ApiResponse<User>>(apiUrl(API_ENDPOINTS.profile), buildProfileBody(profile)),
      );

      return response.data;
    } catch (error) {
      throw toApiError(error);
    }
  }
}

/**
 * Builds the multipart body with the exact field names of the API contract:
 * `fullName`, `mobileNumber`, `dateOfBirth` and the optional `preferredVenueId`.
 * Email and avatar are never appended.
 */
function buildProfileBody(profile: ProfileUpdate): FormData {
  const body = new FormData();
  body.append('fullName', profile.fullName);
  body.append('mobileNumber', profile.mobileNumber);
  body.append('dateOfBirth', profile.dateOfBirth);

  if (profile.preferredVenueId !== null) {
    body.append('preferredVenueId', String(profile.preferredVenueId));
  }

  return body;
}

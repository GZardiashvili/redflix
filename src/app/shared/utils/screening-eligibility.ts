/**
 * Age eligibility for buying a screening, derived from data the API already sends.
 *
 * Two rules, both from the assignment rather than invented here:
 *
 * * A guest is never blocked. The age check happens after logging in, so a
 *   visitor without an account may still open a screening and continue into the
 *   existing authorization flow.
 * * An authenticated user needs an age the server can vouch for. `age` is the
 *   server-derived value; when the profile is incomplete it is `null` and
 *   `dateOfBirth` is the fallback. With neither, the account carries no usable age
 *   information, so it does not meet the minimum — missing data never bypasses
 *   the restriction.
 */

import { User } from '../../core/models/user';

/** Whether the current account may buy a screening of a movie with this rating. */
export type AgeEligibility = 'eligible' | 'restricted' | 'unknown-age';

/**
 * Decides whether `user` meets `minAge`.
 *
 * `minAge` is the movie's own `ageRating.minAge`, so no separate 16/18 rule is
 * hardcoded anywhere: a `G` or `PG` movie (minimum 0) restricts nobody.
 */
export function ageEligibility(user: User | null, minAge: number): AgeEligibility {
  // Either the movie carries no restriction, or there is no account to check yet.
  if (minAge <= 0 || user === null) {
    return 'eligible';
  }

  const age = resolveAge(user);

  if (age === null) {
    return 'unknown-age';
  }

  return age >= minAge ? 'eligible' : 'restricted';
}

/**
 * The user's age, preferring the server's own value over a local computation.
 *
 * `dateOfBirth` is a calendar day, so it is read from its string parts: parsing it
 * as a UTC instant would shift the age back a day east of UTC, wrongly blocking
 * someone on the eve of their birthday.
 */
function resolveAge(user: User): number | null {
  if (typeof user.age === 'number') {
    return user.age;
  }

  if (typeof user.dateOfBirth !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(user.dateOfBirth);
  if (match === null) {
    return null;
  }

  const birthYear = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);

  if (birthYear <= 0 || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return null;
  }

  const today = new Date();
  const month = today.getMonth() + 1;
  // The birthday counts from today itself, matching how the API reports `age`.
  const birthdayPassed =
    month > birthMonth || (month === birthMonth && today.getDate() >= birthDay);
  const age = today.getFullYear() - birthYear - (birthdayPassed ? 0 : 1);

  return age;
}

/**
 * The assignment's restriction message, e.g. `This film is rated 18+. You cannot
 * buy tickets for it with this account.`
 *
 * The wording is fixed; only the rating code comes from the movie.
 */
export function restrictionMessage(ratingCode: string): string {
  return `This film is rated ${ratingCode}. You cannot buy tickets for it with this account.`;
}

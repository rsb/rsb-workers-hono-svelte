/**
 * The words of the profile page's Sessions section
 * (`feature-accounts-profile.md`, Views), written once for the page, the
 * load that words each session, and the tests that hold them. A number in
 * a message comes from the data it words, never from a business constant
 * (L27).
 */

/** Under "Sign out everywhere": what it does to this device (L50). */
export const EVERYWHERE_NOTE = "Includes this device. You’ll need to sign in again.";

/** A session whose sign-in gave no `User-Agent` the label table knows. */
export const UNKNOWN_DEVICE = "Unknown browser";

/** This device's last active: the request that draws the page is its own. */
export const ACTIVE_NOW = "Active now";

const DAY = 24 * 60 * 60 * 1000;

/**
 * "Signed in on N devices." from the one read (L51). With `more`, the
 * list stopped at its bound and the count cannot be known without a
 * second read, which the page does not make: it says so, with the number
 * it did list.
 */
export const devicesLine = (listed: number, more: boolean): string => {
  if (more) {
    return `Signed in on more than ${listed} devices. The ${listed} most recently active are listed.`;
  }
  if (listed === 1) {
    return "Signed in on 1 device.";
  }
  return `Signed in on ${listed} devices.`;
};

/**
 * Another device's last active, from its last touch (L51): a touch writes
 * at most once per half idle window (12 h), so the data cannot say more
 * than the day. The days are 24-hour periods counted back from `now`, not
 * calendar days, since the server draws the page and does not know the
 * person's time zone, so the words name the window, never "today" or
 * "yesterday": under 24 hours is "in the last day", the next 24 "1 day
 * ago", the next "2 days ago", and so on, rounded down.
 */
export const lastActive = (touchedAt: number, now: number): string => {
  const days = Math.max(0, Math.floor((now - touchedAt) / DAY));
  if (days === 0) {
    return "Active in the last day";
  }
  return days === 1 ? "Active 1 day ago" : `Active ${days} days ago`;
};

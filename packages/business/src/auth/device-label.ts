/**
 * The label a session shows on the Sessions page (L51), from the
 * `User-Agent` its sign-in came with: "Firefox on Linux". A small table
 * read in order, not a parser: the first browser and the first system
 * whose mark the string carries. Display only: a `User-Agent` is whatever
 * the client says, so nothing is decided from it.
 */

/**
 * Browsers, most specific first: Edge and Opera say `Chrome/` too, and
 * Chrome says `Safari/`, so each comes before the one it imitates.
 */
const BROWSERS: readonly (readonly [mark: string, name: string])[] = [
  ["Edg/", "Edge"],
  ["EdgiOS/", "Edge"],
  ["EdgA/", "Edge"],
  ["OPR/", "Opera"],
  ["Firefox/", "Firefox"],
  ["FxiOS/", "Firefox"],
  ["CriOS/", "Chrome"],
  ["Chrome/", "Chrome"],
  ["Safari/", "Safari"],
];

/**
 * Systems, most specific first: an iPhone says `like Mac OS X`, Android
 * says `Linux`, and ChromeOS says `X11`.
 */
const SYSTEMS: readonly (readonly [mark: string, name: string])[] = [
  ["iPhone", "iOS"],
  ["iPad", "iPadOS"],
  ["Android", "Android"],
  ["CrOS", "ChromeOS"],
  ["Windows", "Windows"],
  ["Mac OS X", "macOS"],
  ["Linux", "Linux"],
];

const first = (table: typeof BROWSERS, userAgent: string) => table.find(([mark]) => userAgent.includes(mark))?.[1];

/**
 * "<browser> on <system>", or the one of them the table knows, or `null`
 * when it knows neither or there is no `User-Agent`. The page shows a
 * session without a label in its own words.
 */
export const deviceLabel = (userAgent: string | undefined): string | null => {
  if (userAgent === undefined) {
    return null;
  }
  const browser = first(BROWSERS, userAgent);
  const system = first(SYSTEMS, userAgent);
  if (browser !== undefined && system !== undefined) {
    return `${browser} on ${system}`;
  }
  return browser ?? system ?? null;
};

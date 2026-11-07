type Api = Pick<Fetcher, "fetch">;

/**
 * The browser request's headers the api reads, and nothing else: the
 * session cookie for `authenticate`, where the request came from for
 * `channel` (L38), and the `User-Agent` a new session's label is made from
 * (L51). Another header the browser sent stays in the BFF.
 */
export const FORWARDED = ["Cookie", "Origin", "Sec-Fetch-Site", "Sec-Fetch-Mode", "User-Agent"] as const;

/**
 * The browser request's city, as the platform puts it on `request.cf`, or
 * undefined. A browser cannot set it: the platform writes `cf`, and the
 * call to the api is built here, not passed through.
 */
const cityOf = (from: Request): string | undefined => {
  const cf = (from as { cf?: { city?: unknown } }).cf;
  return typeof cf?.city === "string" && cf.city !== "" ? cf.city : undefined;
};

/**
 * The `API` binding as one browser request sees it: every call carries that
 * request's forwarded headers, as it sent them, and its city on the call's
 * own `request.cf`, which a binding carries to the api (L51: display only).
 * The BFF reads none of them and decides nothing (L38); the api's gates do.
 * A header the browser did not send is not sent.
 */
export const forwarding = (api: Api, from: Request): Api => ({
  fetch: (input, init) => {
    const call = new Request(input, init);
    const headers = new Headers(call.headers);
    for (const name of FORWARDED) {
      const value = from.headers.get(name);
      if (value !== null) {
        headers.set(name, value);
      }
    }
    const forwarded = new Request(call, { headers });
    const city = cityOf(from);
    if (city === undefined) {
      return api.fetch(forwarded);
    }
    // Only the city: the api reads nothing else of it.
    return api.fetch(forwarded, { cf: { city } as RequestInitCfProperties });
  },
});

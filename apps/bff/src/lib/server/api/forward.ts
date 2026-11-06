type Api = Pick<Fetcher, "fetch">;

/**
 * The browser request's headers the api reads, and nothing else: the
 * session cookie for `authenticate`, and where the request came from for
 * `channel` (L38). Another header the browser sent stays in the BFF.
 */
export const FORWARDED = ["Cookie", "Origin", "Sec-Fetch-Site", "Sec-Fetch-Mode"] as const;

/**
 * The `API` binding as one browser request sees it: every call carries that
 * request's forwarded headers, as it sent them. The BFF reads none of them
 * and decides nothing (L38); the api's gates do. A header the browser did
 * not send is not sent.
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
    return api.fetch(new Request(call, { headers }));
  },
});

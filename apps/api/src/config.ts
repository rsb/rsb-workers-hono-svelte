// Configuration is data the api reads at startup: plain values that vary by
// deployment, like limits, URLs and flags. Bindings such as D1 are not
// configuration: the platform hands them over already configured and built,
// so they go straight to `constructInfra`. Each value is a `vars` entry in
// `wrangler.jsonc`; local dev overrides one in `.dev.vars`.

/** The api's configuration, as construct takes it. */
export type Config = {
  /** The BFF's origin, which the `channel` gate compares `Origin` with (L38). */
  bffOrigin: string;
  /**
   * The session cookie's name: `__Host-sid`, or `sid` under
   * `http://localhost`, where a browser refuses a `__Host-` cookie (PRD,
   * Security). It is one value; no code branches on the environment.
   */
  sessionCookie: string;
};

/** The configuration, from the Worker's vars. They are not checked yet; checking them is a later commit's. */
export const configOf = (vars: { BFF_ORIGIN: string; SESSION_COOKIE: string }): Config => ({
  bffOrigin: vars.BFF_ORIGIN,
  sessionCookie: vars.SESSION_COOKIE,
});

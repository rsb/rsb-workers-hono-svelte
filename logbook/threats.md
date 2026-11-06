# Threats

The threats the app answers, each with its mitigation, its source, its
home in the entry chain and the test that exercises it. The security
number in [pillars-view.md](pillars-view.md) is counted from this
table: rows with a test, of all rows. It is a record, not a spec. No
check joins it to the code.

The thirteen rows are seeded from the auth design's section 9
(`reports/2026-11-05-22-auth-design.html`). That section also named the
kind of test each row would get. Here the Test column names only tests
that exist, so an empty cell means no test yet, and the slice that
brings the mitigation fills it in. A test entry is `file › test title`,
or a short description where a file holds the whole set.

| # | Threat | Mitigation | Source | Home | Test |
|---|---|---|---|---|---|
| 1 | CSRF on the cookie api | The `channel` gate (L38): an unsafe request carrying the session cookie must say `Sec-Fetch-Site` same-origin or none, or, without it, an `Origin` equal to the BFF's; with neither it is refused. Its body must be `application/json`, the type no cross-site form can send without a preflight. | OWASP CSRF; ASVS 3.5.1–3.5.3 | BFF, gate | `apps/api/test/unit/gates/channel.test.ts`: each `Sec-Fetch-Site` value, the `Origin` fallback, neither header, and each form, text and untyped body. `apps/api/test/integration/gates.test.ts › refuses a change from another origin`. `apps/bff/e2e/session.test.ts › given the member's session cookie, the page loads and the add form posts through the channel gate` and `› given the member's session cookie, a cross-site form post is refused and adds nothing`. The e2e post is the gate's first catch: the BFF sent its own writes as `text/plain`, the CSRF-friendly type, and the gate refused them until they declared JSON (stage 23, commit 7). Under local dev the binding's proxy, Miniflare, refuses a foreign `Origin` itself, with a plain-text `403 Invalid Origin header` the api never sees. So the e2e post sends `Sec-Fetch-Site: cross-site` alone, and the unit tests cover production's `Origin` fallback. |
| 2 | SameSite=Lax top-level POST gap | Explicit `SameSite=Lax`; no state change on GET. | rfc6265bis §5.6.7.2 | BFF, operation | |
| 3 | Session fixation | A new session row per sign-in, the old one ended; server-minted ids only. | ASVS 7.2.4 | operation | |
| 4 | Cookie scope across Workers | `__Host-`; the api is reachable by binding only; `workers_dev = false`. | ASVS 3.3.1/3.3.3/3.3.4 | BFF, platform, gate | `apps/api/test/unit/config.test.ts › refuses a __Host- or __Secure- cookie with an http BFF`. `tooling/config/session-cookie.test.ts`: the BFF and the api name the same cookie, `__Host-` deployed. `apps/api/test/integration/sessions-current.test.ts › answers a cookie that names no live session as anonymous, and says to clear it`: the api writes no `Set-Cookie`. |
| 5 | Open redirect in OAuth | Exact `redirect_uri`; state and PKCE; issuer check. | RFC 9700 | operation | |
| 6 | Open redirect in returnTo | A same-origin path only. | OWASP Redirects | BFF | |
| 7 | Enumeration | Uniform body, status and timing; a dummy hash when the user is missing; always "sent". | ASVS 6.3.8 | operation, process | |
| 8 | Credential stuffing | A per-account counter with backoff; Turnstile; the Rate Limiting binding keyed on the account; one WAF rule; a breached-password check. | ASVS 6.3.1/6.1.1/6.2.12 | platform, operation | |
| 9 | Verification tokens | 256-bit, hashed, single use, ≤ 10 min, consumed on POST. | ASVS 6.5.1/6.5.3/6.5.5/6.6.2 | operation, store, BFF | |
| 10 | Sign-out semantics | One row or all rows (with re-auth); an expiring `Set-Cookie`; `Clear-Site-Data` as a courtesy. | ASVS 7.4.1/7.4.5/7.5.2 | operation, BFF | |
| 11 | Password change leaves sessions alive | The current password required; rotate; offer to end the others; notify; invalidate reset links. | ASVS 6.2.3/7.4.3/6.3.7 | process | |
| 12 | Clickjacking and headers | CSP `frame-ancestors 'none'` in the header from `handle`; HSTS 1 year; `nosniff`; COOP; Hono's `secureHeaders()` on the api. | ASVS 3.4.x | BFF, api | |
| 13 | Subdomain takeover and cookie tossing | `__Host-`; workers.dev is a public suffix; exact CORS strings; the gate reads only the configured name. | ASVS 3.3.3/3.5.4 | BFF, platform, gate | `apps/api/test/integration/gates.test.ts › reads no cookie of another name`. `apps/api/test/unit/gates/channel.test.ts › is one with a cookie of another name`. |

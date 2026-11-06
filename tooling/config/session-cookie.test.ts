// The BFF names the session cookie only to delete a stale one (L39); the
// api reads its name from config. The two must agree, or a stale cookie
// outlives the session it named. The dev branch is the BFF's: no browser
// accepts a `__Host-` cookie over http (apps/bff/src/lib/server/session/cookie.ts).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DEV_SESSION_COOKIE, SESSION_COOKIE } from "../../apps/bff/src/lib/server/session/cookie.ts";

// wrangler.jsonc is JSON with comments; the one line that names the cookie is enough.
const configured = /"SESSION_COOKIE": "([^"]+)"/.exec(readFileSync("apps/api/wrangler.jsonc", "utf8"))?.[1];

describe("the session cookie's name, in the BFF and the api", () => {
  it("is the api's configured name, deployed", () => {
    assert.equal(SESSION_COOKIE, configured);
  });

  it("is the same name without __Host-, in dev", () => {
    assert.ok(SESSION_COOKIE.startsWith("__Host-"), SESSION_COOKIE);
    assert.equal(DEV_SESSION_COOKIE, SESSION_COOKIE.slice("__Host-".length));
  });
});

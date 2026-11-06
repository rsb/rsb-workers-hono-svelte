import { SESSION_ABSOLUTE_MS } from "@todo/business/auth/session.ts";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { env } from "cloudflare:workers";
import { sha256Hex } from "../../src/gates/digest.ts";
import { ADMIN, MEMBER } from "./signed-in.ts";

// Runs after the migrations, in each test file's fresh databases: a member
// and an admin, each with a live bearer session, through the identity
// store's own methods, as the dev seed does.

const store = createIdentityStore(env.IDENTITY_DB);
const now = Date.now();

for (const actor of [MEMBER, ADMIN]) {
  const user = { id: actor.userId, email: `${actor.userId}@example.com`, name: actor.userId, role: actor.role, createdAt: now };
  const created = await store.createUser(user);
  const started = await store.startSession({
    id: `s-${actor.userId}`,
    tokenHash: await sha256Hex(actor.token),
    userId: actor.userId,
    channel: "bearer",
    createdAt: now,
    idleUntil: null,
    expiresAt: now + SESSION_ABSOLUTE_MS,
  });
  if (!created.ok || !created.value || !started.ok || !started.value) {
    throw new Error(`the session seed failed for ${actor.userId}`);
  }
}

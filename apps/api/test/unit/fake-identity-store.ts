import type { SessionRow } from "@todo/business/auth/session.ts";
import { ok } from "@todo/business/result.ts";
import type { IdentityStore } from "@todo/data-d1/identity/store.ts";
import type { User } from "@todo/data-d1/identity/users.ts";

/**
 * A fake identity store that keeps session rows by token hash, and records
 * each hash it is asked for and each touch it makes. Only the gates read it
 * today; the user methods keep users by email.
 */
export const fakeIdentityStore = (sessions: Record<string, SessionRow> = {}) => {
  const asked: string[] = [];
  const touched: { id: string; idleUntil: number; now: number }[] = [];
  const users = new Map<string, User>();

  const store: IdentityStore = {
    findSession: async (tokenHash) => {
      asked.push(tokenHash);
      return ok(sessions[tokenHash] ?? null);
    },
    touchSession: async (input) => {
      touched.push(input);
      return ok(true);
    },
    startSession: async () => ok(true),
    createUser: async (user) => {
      if (users.has(user.email)) {
        return ok(false);
      }
      users.set(user.email, { ...user, disabled: false, emailVerifiedAt: null });
      return ok(true);
    },
    findUserByEmail: async (email) => ok(users.get(email) ?? null),
  };
  return { store, asked, touched };
};

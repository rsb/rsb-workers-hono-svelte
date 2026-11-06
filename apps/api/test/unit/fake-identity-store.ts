import type { SignInCredential, SignInWrite } from "@todo/business/auth/credential.ts";
import type { SessionRow } from "@todo/business/auth/session.ts";
import { ok } from "@todo/business/result.ts";
import type { IdentityStore } from "@todo/data-d1/identity/store.ts";
import type { User } from "@todo/data-d1/identity/users.ts";

/**
 * A fake identity store that keeps session rows by token hash and
 * credentials by email, and records what it is asked: each hash looked up,
 * each touch, each sign-in's batch and each session ended. It does not
 * apply a write to what it keeps: the integration tests run the real
 * statements, and these say only what the api asked for. The user methods
 * keep users by email, for the seed's tests.
 */
export const fakeIdentityStore = (sessions: Record<string, SessionRow> = {}, credentials: Record<string, SignInCredential> = {}) => {
  const asked: string[] = [];
  const touched: { id: string; idleUntil: number; now: number }[] = [];
  const signIns: SignInWrite[] = [];
  const ended: { ownerId: string; id: string | null; reason: string }[] = [];
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
    endSession: async (scope, input) => {
      ended.push({ ownerId: scope.ownerId, id: input.id, reason: input.reason });
      return ok(true);
    },
    endAllSessions: async (scope, input) => {
      ended.push({ ownerId: scope.ownerId, id: null, reason: input.reason });
      return ok(1);
    },
    listSessions: async () => ok({ sessions: [], more: false }),
    recordSignIn: async (write) => {
      signIns.push(write);
      return ok({ started: true });
    },
    findForSignIn: async (email) => ok(credentials[email] ?? null),
    setCredential: async () => ok(undefined),
    createUser: async (user) => {
      if (users.has(user.email)) {
        return ok(false);
      }
      users.set(user.email, { ...user, disabled: false, emailVerifiedAt: null });
      return ok(true);
    },
    findUserByEmail: async (email) => ok(users.get(email) ?? null),
  };
  return { store, asked, touched, signIns, ended };
};

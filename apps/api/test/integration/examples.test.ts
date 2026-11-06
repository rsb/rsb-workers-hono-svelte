import { TODO_LIMIT } from "@todo/business/rules.ts";
import { BODY_LIMIT_BYTES, type EndpointKey, endpoints, success } from "@todo/contract-api";
import { type Example, everyExamples, examples } from "@todo/contract-api/examples";
import argon2Wasm from "@phi-ag/argon2/argon2.wasm";
import { SESSION_ABSOLUTE_MS } from "@todo/business/auth/session.ts";
import { createIdentityStore } from "@todo/data-d1/identity/store.ts";
import { createDbStore } from "@todo/data-d1/store.ts";
import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { argon2FromWasm, createHasher } from "../../src/auth/hasher.ts";
import { readConfig } from "../../src/config.ts";
import { sha256Hex } from "../../src/gates/digest.ts";
import { MEMBER } from "./signed-in.ts";

/**
 * The spec's examples (`prd/todo/api.md`, generated into the contract) sent
 * to the Worker as written. A failure must answer the example's whole reply.
 * A success must answer its status and a reply the endpoint's schema
 * accepts; its exact data stays with the hand-written tests, because the
 * examples share one database (DB9) and the spec does not state what each
 * one starts from. An endpoint's example is sent as the member, since every
 * todo operation requires one, on a bearer session of its own, so an
 * example that signs out ends only its own; a sign-in is sent as the BFF's
 * page sends it, with no session. A shared one is sent as the spec words it.
 */

/**
 * The examples the replay does not run, each with what covers it instead.
 * The guard below fails on a name here that is not an example, so the list
 * cannot outlive what it excuses.
 */
const notReplayed: Record<string, string> = {
  "POST /todos: the list is full":
    "todos-limit.test.ts, todos.cap: the 501st todo is rejected with limit; it needs 500 adds first",
  "every endpoint: the server fails": "nothing yet; no request makes the api fail without a fault port",
};

/** How a shared example, which has no request in the spec, is sent. */
const sharedRequests: Record<string, () => Request> = {
  "a body over the limit": () =>
    new Request("https://todo-api/todos", { method: "POST", body: "x".repeat(BODY_LIMIT_BYTES + 1) }),
  "a bearer token that names no session": () =>
    new Request("https://todo-api/todos", { headers: { Authorization: `Bearer ${"u".repeat(43)}` } }),
  "a change from another site, with the session cookie": () =>
    new Request("https://todo-api/todos", {
      method: "POST",
      body: '{"title":"buy milk"}',
      headers: {
        Cookie: `${env.SESSION_COOKIE}=${"u".repeat(43)}`,
        "Content-Type": "application/json",
        "Sec-Fetch-Site": "cross-site",
      },
    }),
};

/** Starts a fresh bearer session for the member and gives its raw token. */
let sessions = 0;
const freshMemberToken = async () => {
  sessions += 1;
  const token = `${sessions}`.padStart(43, "x");
  const now = Date.now();
  const started = await createIdentityStore(env.IDENTITY_DB).recordSignIn({
    session: {
      id: `s-example-${sessions}`,
      tokenHash: await sha256Hex(token),
      userId: MEMBER.userId,
      channel: "bearer",
      createdAt: now,
      idleUntil: null,
      expiresAt: now + SESSION_ABSOLUTE_MS,
      label: null,
      city: null,
    },
  });
  if (!started.ok || !started.value.started) {
    throw new Error("the example's session could not be started");
  }
  return token;
};

/** The endpoints whose examples are sent as the BFF's page sends them, with no session. */
const FROM_THE_PAGE: EndpointKey[] = ["POST /sessions"];

const toRequest = async (key: EndpointKey, request: NonNullable<Example["request"]>) => {
  const url = new URL(request.path, "https://todo-api");
  for (const [name, value] of request.query) {
    url.searchParams.append(name, value);
  }
  let body: string | null = null;
  if (request.body !== undefined) {
    body = JSON.stringify(request.body);
  }
  if (FROM_THE_PAGE.includes(key)) {
    return new Request(url, { method: request.method, body, headers: { "Sec-Fetch-Site": "same-origin", "Content-Type": "application/json" } });
  }
  // As the member, by a bearer session: every todo operation requires one.
  return new Request(url, { method: request.method, body, headers: { Authorization: `Bearer ${await freshMemberToken()}` } });
};

/** Ada's account, which the sign-in examples name: the user, then the password. */
const ADA = { id: "u-ada", email: "ada@example.com", password: "correct horse battery staple" };

const seedAda = async () => {
  const identity = createIdentityStore(env.IDENTITY_DB);
  const created = await identity.createUser({ id: ADA.id, email: ADA.email, name: "Ada Lovelace", role: "member", createdAt: Date.now() });
  if (!created.ok) {
    throw created.error;
  }
  if (!created.value) {
    return;
  }
  const config = readConfig(env);
  if (!config.ok) {
    throw new Error("the integration config does not read");
  }
  const hashed = await createHasher({ argon2: argon2FromWasm(argon2Wasm), peppers: config.value.peppers }).hash(ADA.password);
  if (!hashed.ok) {
    throw hashed.error;
  }
  const set = await identity.setCredential({ userId: ADA.id, kind: "password", ...hashed.value, now: Date.now() });
  if (!set.ok) {
    throw set.error;
  }
};

/**
 * Seed what the request names and nothing more: a succeeding example whose
 * path names an id needs a todo with that id, and a sign-in needs the
 * account it names. It goes in through the store,
 * so the replay never knows the table, and is skipped when an earlier example
 * left it there.
 */
const seed = async (key: EndpointKey, example: Example) => {
  if (key === "POST /sessions") {
    await seedAda();
    return;
  }
  const id = example.request?.params.id;
  if (id === undefined) {
    return;
  }
  const store = createDbStore(env.APP_DB);
  const own = { ownerId: MEMBER.userId };
  const listed = await store.listTodos(own, {});
  if (!listed.ok) {
    throw new Error("the seed could not list the todos");
  }
  if (listed.value.some((todo) => todo.id === id)) {
    return;
  }
  const added = await store.addTodoUnlessFull(own, { id, title: "seeded", completed: false }, TODO_LIMIT);
  if (!added.ok || !added.value) {
    throw new Error(`the seed could not add todo ${id}`);
  }
};

const check = async (response: Response, example: Example, key?: EndpointKey) => {
  expect(response.status).toBe(example.status);
  const reply = await response.json();
  if (key !== undefined && example.status === endpoints[key].status) {
    expect(() => v.parse(success(endpoints[key].reply), reply)).not.toThrow();
    return;
  }
  expect(reply).toEqual(example.reply);
};

const endpointCases = Object.entries(examples).flatMap(([key, list]) =>
  list
    .map((example) => [`${key}: ${example.name}`, key as EndpointKey, example] as const)
    .filter(([name]) => !(name in notReplayed)),
);

const sharedCases = everyExamples
  .map((example) => [`every endpoint: ${example.name}`, example] as const)
  .filter(([name]) => !(name in notReplayed));

describe("the spec's examples, replayed", () => {
  it.each(endpointCases)("%s", async (_, key, example) => {
    const request = example.request;
    if (request === undefined) {
      throw new Error("an endpoint example has no request");
    }
    if (example.status === endpoints[key].status) {
      await seed(key, example);
    }

    await check(await exports.default.fetch(await toRequest(key, request)), example, key);
  });

  it.each(sharedCases)("%s", async (name, example) => {
    const send = sharedRequests[example.name];
    if (send === undefined) {
      throw new Error(`${name} has no way to be sent; add it to sharedRequests or notReplayed`);
    }

    await check(await exports.default.fetch(send()), example);
  });
});

it("every example is replayed or on the not-replayed list, never both or neither", () => {
  const every = [
    ...Object.entries(examples).flatMap(([key, list]) => list.map((example) => `${key}: ${example.name}`)),
    ...everyExamples.map((example) => `every endpoint: ${example.name}`),
  ];
  const replayed = [...endpointCases.map(([name]) => name), ...sharedCases.map(([name]) => name)];

  expect(Object.keys(notReplayed).filter((name) => !every.includes(name))).toEqual([]);
  expect(replayed.filter((name) => name in notReplayed)).toEqual([]);
  expect([...replayed, ...Object.keys(notReplayed)].sort()).toEqual([...every].sort());
  const unsent = everyExamples.filter(
    (example) => !(`every endpoint: ${example.name}` in notReplayed) && !(example.name in sharedRequests),
  );
  expect(unsent.map((example) => example.name)).toEqual([]);
});

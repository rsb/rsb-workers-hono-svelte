import { TODO_LIMIT } from "@todo/business/rules.ts";
import { BODY_LIMIT_BYTES, type EndpointKey, endpoints, success } from "@todo/contract-api";
import { type Example, everyExamples, examples } from "@todo/contract-api/examples";
import { createDbStore } from "@todo/data-d1/store.ts";
import { env, exports } from "cloudflare:workers";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

/**
 * The spec's examples (`prd/todo/api.md`, generated into the contract) sent
 * to the Worker as written. A failure must answer the example's whole reply.
 * A success must answer its status and a reply the endpoint's schema
 * accepts; its exact data stays with the hand-written tests, because the
 * examples share one database (DB9) and the spec does not state what each
 * one starts from.
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
};

const toRequest = (request: NonNullable<Example["request"]>) => {
  const url = new URL(request.path, "https://todo-api");
  for (const [name, value] of request.query) {
    url.searchParams.append(name, value);
  }
  let body: string | null = null;
  if (request.body !== undefined) {
    body = JSON.stringify(request.body);
  }
  return new Request(url, { method: request.method, body });
};

/**
 * Seed what the request names and nothing more: a succeeding example whose
 * path names an id needs a todo with that id. It goes in through the store,
 * so the replay never knows the table, and is skipped when an earlier example
 * left it there.
 */
const seed = async (example: Example) => {
  const id = example.request?.params.id;
  if (id === undefined) {
    return;
  }
  const store = createDbStore(env.APP_DB);
  const listed = await store.listTodos({});
  if (!listed.ok) {
    throw new Error("the seed could not list the todos");
  }
  if (listed.value.some((todo) => todo.id === id)) {
    return;
  }
  const added = await store.addTodoUnlessFull({ id, title: "seeded", completed: false }, TODO_LIMIT);
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
      await seed(example);
    }

    await check(await exports.default.fetch(toRequest(request)), example, key);
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

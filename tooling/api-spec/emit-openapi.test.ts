import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse as parseAccess } from "../access/parse.ts";
import { readRoutes } from "../entry-chains/routes.ts";
import { SESSION_COOKIE, emitOpenApi } from "./emit-openapi.ts";
import { type Endpoint, parse } from "./parse.ts";

const parsed = parse(readFileSync("prd/todo/api.md", "utf8"));
assert.ok(parsed.ok);
const accessed = parseAccess(readFileSync("prd/todo/access.md", "utf8"));
assert.ok(accessed.ok);
const access = accessed.rows;
const routes = await readRoutes("apps/api/src/construct.ts");
const doc = JSON.parse(emitOpenApi(parsed.spec, routes, access, "prd/todo/api.md", "test"));

type Node = Record<string, unknown>;

/** Every `$ref` in the document, wherever it is. */
const refs = (node: unknown, found: string[] = []): string[] => {
  if (Array.isArray(node)) {
    for (const item of node) {
      refs(item, found);
    }
  } else if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") {
        found.push(value);
      } else {
        refs(value, found);
      }
    }
  }
  return found;
};

/** Follows a local `#/a/b` pointer; undefined when it leads nowhere. */
const resolve = (pointer: string): unknown =>
  pointer
    .slice(2)
    .split("/")
    .reduce<unknown>((node, key) => (node as Node | undefined)?.[key], doc);

const operations = Object.entries(doc.paths as Record<string, Record<string, Node>>).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ key: `${method.toUpperCase()} ${path}`, op })),
);

describe("the OpenAPI document", () => {
  it("is OpenAPI 3.1", () => {
    assert.match(doc.openapi, /^3\.1\.\d+$/);
  });

  it("resolves every $ref", () => {
    const found = refs(doc);
    assert.ok(found.length > 0);
    for (const pointer of found) {
      assert.ok(pointer.startsWith("#/"), pointer);
      assert.notEqual(resolve(pointer), undefined, pointer);
    }
  });

  it("has every endpoint of the spec", () => {
    const keys = parsed.spec.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    assert.deepEqual(operations.map((operation) => operation.key).sort(), keys.sort());
  });

  it("lists statuses in ascending order", () => {
    for (const { key, op } of operations) {
      const statuses = Object.keys(op.responses as Node).map(Number);
      assert.deepEqual(statuses, [...statuses].sort((a, b) => a - b), key);
    }
  });

  it("has an example on every response", () => {
    for (const { key, op } of operations) {
      for (const [status, response] of Object.entries(op.responses as Record<string, Node>)) {
        const answered = (response.$ref ? resolve(response.$ref as string) : response) as Node;
        const content = (answered.content as Record<string, Node>)["application/json"] as Node;
        assert.ok(Object.keys((content.examples as Node | undefined) ?? {}).length > 0, `${key} ${status}`);
      }
    }
  });

  it("names each operation by its entry point, and each unit it runs", () => {
    for (const route of routes) {
      const found = operations.find((operation) => operation.key === route.key);
      assert.ok(found, route.key);
      assert.equal(found.op.operationId, route.name, route.key);
      if (route.unit === null) {
        assert.equal("x-unit" in found.op, false, route.key);
      } else {
        assert.equal(found.op["x-unit"], route.unit, route.key);
      }
    }
  });

  it("gives every operation a different operationId", () => {
    const ids = operations.map((operation) => operation.op.operationId);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("says who may call each operation, by either credential, and lets an anonymous one call with neither", () => {
    assert.deepEqual(Object.keys(doc.components.securitySchemes).sort(), ["bearer", "session"]);
    for (const { key, op } of operations) {
      const endpoint: Endpoint | undefined = parsed.spec.endpoints.find((found) => `${found.method} ${found.path}` === key);
      assert.equal(op["x-requires"], endpoint?.security, key);
      const credentials = [{ session: [] }, { bearer: [] }];
      assert.deepEqual(op.security, endpoint?.security === "anonymous" ? [{}, ...credentials] : credentials, key);
    }
  });

  it("names the session cookie the api is configured with", () => {
    // wrangler.jsonc is JSON with comments; the one line that names the cookie is enough.
    const configured = /"SESSION_COOKIE": "([^"]+)"/.exec(readFileSync("apps/api/wrangler.jsonc", "utf8"))?.[1];
    assert.equal(SESSION_COOKIE, configured);
    assert.equal(doc.components.securitySchemes.session.name, configured);
  });

  it("has no x-unit on the probe", () => {
    const health = operations.find((operation) => operation.key === "GET /health");
    assert.equal(health?.op.operationId, "getHealth");
    assert.equal(health !== undefined && "x-unit" in health.op, false);
  });
});

describe("routes against the spec", () => {
  it("refuses an endpoint with no route", () => {
    const fewer = routes.filter((route) => route.key !== "POST /todos");
    assert.throws(() => emitOpenApi(parsed.spec, fewer, access, "s", "t"), /the spec has POST \/todos, and construct has no route/);
  });

  it("refuses a route the spec does not list", () => {
    const more = [...routes, { key: "PUT /todos", name: "putTodos", unit: null, validator: null }];
    assert.throws(() => emitOpenApi(parsed.spec, more, access, "s", "t"), /construct has a route for PUT \/todos/);
  });

  it("refuses two routes with one operationId", () => {
    const twice = routes.map((route) => {
      if (route.key === "GET /todos/counts") {
        return { ...route, name: "getTodos" };
      }
      return route;
    });
    assert.throws(() => emitOpenApi(parsed.spec, twice, access, "s", "t"), /GET \/todos and GET \/todos\/counts have the same operationId, getTodos/);
  });
});

describe("Security: against access.md", () => {
  /** The spec with one endpoint's Security: changed. */
  const securing = (key: string, security: "anonymous" | "member" | "admin") => ({
    ...parsed.spec,
    endpoints: parsed.spec.endpoints.map((endpoint) =>
      `${endpoint.method} ${endpoint.path}` === key ? { ...endpoint, security } : endpoint,
    ),
  });

  it("refuses an endpoint whose Security: is not its unit's row", () => {
    assert.throws(
      () => emitOpenApi(securing("GET /todos", "anonymous"), routes, access, "s", "t"),
      /GET \/todos says Security: anonymous, but listTodos's row in access\.md requires member/,
    );
  });

  it("refuses a probe that says anything but anonymous", () => {
    assert.throws(
      () => emitOpenApi(securing("GET /health", "member"), routes, access, "s", "t"),
      /GET \/health says Security: member, but it is a probe, which runs no unit: anonymous/,
    );
  });

  it("refuses a route whose unit has no row", () => {
    const rowless = access.filter((row) => row.operation !== "countTodos");
    assert.throws(() => emitOpenApi(parsed.spec, routes, rowless, "s", "t"), /GET \/todos\/counts runs countTodos, which has no row in access\.md/);
  });
});

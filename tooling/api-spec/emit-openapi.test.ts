import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emitOpenApi } from "./emit-openapi.ts";
import { parse } from "./parse.ts";

const parsed = parse(readFileSync("prd/todo/api.md", "utf8"));
assert.ok(parsed.ok);
const doc = JSON.parse(emitOpenApi(parsed.spec, "prd/todo/api.md", "test"));

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
});

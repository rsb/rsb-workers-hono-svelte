import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse, parseField, parseType } from "./parse.ts";

/** A spec with every section, the given endpoints and shapes. */
const spec = (endpoints: string, shapes = "") => `# Test api

## Every endpoint

Errors: \`internal\`

## Errors

- \`validation\`, with field
- \`not_found\`
- \`internal\`

## Shapes
${shapes}
## Endpoints
${endpoints}`;

const problems = (source: string) => {
  const parsed = parse(source);
  if (parsed.ok) {
    return [];
  }
  return parsed.problems.map((problem) => problem.message);
};

describe("parseType", () => {
  it("reads each type", () => {
    assert.deepEqual(parseType("text"), { kind: "text" });
    assert.deepEqual(parseType("boolean"), { kind: "boolean" });
    assert.deepEqual(parseType("integer, min 0"), { kind: "integer", min: 0 });
    assert.deepEqual(parseType("literal `true`"), { kind: "literal", value: true });
    assert.deepEqual(parseType('literal `"true"`'), { kind: "literal", value: "true" });
    assert.deepEqual(parseType('one of `"a"` `"b"`'), { kind: "oneOf", values: ["a", "b"] });
    assert.deepEqual(parseType("list of `Todo`"), { kind: "listOf", shape: "Todo" });
    assert.deepEqual(parseType("`Todo`"), { kind: "ref", shape: "Todo" });
  });

  it("names a type it does not know", () => {
    assert.equal(parseType("string"), 'unknown type "string"');
  });
});

describe("parseField", () => {
  it("reads a required field without a message", () => {
    assert.deepEqual(parseField("- `id`: text"), { name: "id", type: { kind: "text" }, optional: false, message: undefined });
  });

  it("reads optional and the message", () => {
    assert.deepEqual(parseField('- `title`: text, optional "title must be text"'), {
      name: "title",
      type: { kind: "text" },
      optional: true,
      message: "title must be text",
    });
  });

  it("keeps the comma inside integer, min N", () => {
    assert.deepEqual(parseField("- `n`: integer, min 0, optional"), {
      name: "n",
      type: { kind: "integer", min: 0 },
      optional: true,
      message: undefined,
    });
  });
});

describe("parse", () => {
  it("reads the todo api", () => {
    const parsed = parse(readFileSync("prd/todo/api.md", "utf8"));
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.equal(parsed.spec.endpoints.length, 8);
    assert.deepEqual(parsed.spec.everyKinds, ["too_large", "internal"]);
  });

  it("reads an endpoint's parts and its inline shapes", () => {
    const parsed = parse(
      spec(`
### \`PATCH /todos/{id}\`
Serves: \`use-cases/todos/change-a-todo.md\`.

Path:
- \`id\`: text

Body: \`PatchTodoBody\`, at least 1 field "body must have a field"
- \`title\`: text, optional

Reply: 200 \`Todo\`
- \`id\`: text

Errors: \`validation\`, \`not_found\`
`),
    );
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    const [endpoint] = parsed.spec.endpoints;
    assert.equal(endpoint?.serves, "`use-cases/todos/change-a-todo.md`");
    assert.deepEqual(endpoint?.params.map((param) => param.name), ["id"]);
    assert.equal(endpoint?.body, "PatchTodoBody");
    assert.equal(endpoint?.status, 200);
    assert.deepEqual(endpoint?.errors, ["validation", "not_found"]);
    const body = parsed.spec.shapes.find((shape) => shape.name === "PatchTodoBody");
    assert.ok(body?.kind === "object");
    assert.deepEqual(body.atLeast, { fields: 1, message: "body must have a field" });
  });

  it("refuses a kind every endpoint already returns", () => {
    const found = problems(
      spec("\n### `GET /a`\nServes: x.\n\nReply: 200 `R`\n- `ok`: boolean\n\nErrors: `internal`\n"),
    );
    assert.deepEqual(found, ["kind internal is one every endpoint can return; list only the kinds it adds"]);
  });

  it("refuses a path parameter Path: does not list", () => {
    const found = problems(spec("\n### `GET /a/{id}`\nServes: x.\n\nReply: 200 `R`\n- `ok`: boolean\n\nErrors: none\n"));
    assert.deepEqual(found, ["GET /a/{id} names {id} in its path but Path: lists none"]);
  });

  it("refuses parts out of order", () => {
    const found = problems(spec("\n### `GET /a`\nReply: 200 `R`\n- `ok`: boolean\n\nServes: x.\n\nErrors: none\n"));
    assert.deepEqual(found, ["Serves: is out of order; the order is Serves, Path, Query, Body, Reply, Errors"]);
  });

  it("refuses a shape that is not defined", () => {
    const found = problems(spec("\n### `GET /a`\nServes: x.\n\nReply: 200 `Missing`\n\nErrors: none\n"));
    assert.deepEqual(found, ["shape Missing is not defined"]);
  });

  it("refuses a kind not in Errors", () => {
    const found = problems(spec("\n### `GET /a`\nServes: x.\n\nReply: 200 `R`\n- `ok`: boolean\n\nErrors: `limit`\n"));
    assert.deepEqual(found, ["kind limit is not in Errors"]);
  });

  it("refuses an endpoint without Errors:", () => {
    const found = problems(spec("\n### `GET /a`\nServes: x.\n\nReply: 200 `R`\n- `ok`: boolean\n"));
    assert.deepEqual(found, ['GET /a has no Errors:; write "Errors: none" when it adds none']);
  });

  it("refuses a table row", () => {
    const found = problems(spec("\n### `GET /a`\nServes: x.\n\n| a | b |\n\nReply: 200 `R`\n- `ok`: boolean\n\nErrors: none\n"));
    assert.equal(found.length, 1);
    assert.match(found[0] ?? "", /^an endpoint holds only/);
  });

  it("reads a shared list shape", () => {
    const parsed = parse(
      spec(
        "\n### `GET /a`\nServes: x.\n\nReply: 200 `TodoList`\n\nErrors: none\n",
        "\n### `Todo`\nA todo.\n- `id`: text\n\n### `TodoList`\nlist of `Todo`\n",
      ),
    );
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.deepEqual(parsed.spec.shared, ["Todo", "TodoList"]);
    const list = parsed.spec.shapes.find((shape) => shape.name === "TodoList");
    assert.deepEqual(list, { name: "TodoList", doc: undefined, kind: "list", of: "Todo" });
  });
});

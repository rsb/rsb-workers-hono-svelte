import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse, parseField, parseType } from "./parse.ts";

/** A spec with every section, the given endpoints and shapes. */
const spec = (endpoints: string, shapes = "") => `# Test api

## Every endpoint

Errors: \`internal\`

Examples:

Example: the server fails
Reply: 500
\`\`\`json
{ "ok": false, "error": { "kind": "internal", "message": "internal error" } }
\`\`\`

## Errors

- \`validation\`: 422, with field
- \`not_found\`: 404
- \`internal\`: 500

## Shapes
${shapes}
## Endpoints
${endpoints}`;

/** An Examples: part with one success of `GET /a`, replying `{ "ok": true }`. */
const works = `
Examples:

Example: works
Request: \`GET /a\`
Reply: 200
\`\`\`json
{ "ok": true, "data": { "ok": true } }
\`\`\`
`;

/** An endpoint `GET /a` with the given examples. */
const getA = (examples: string, errors = "none") =>
  `\n### \`GET /a\`\nServes: x.\nSecurity: \`anonymous\`\n\nReply: 200 \`R\`\n- \`ok\`: boolean\n\nErrors: ${errors}\n${examples}`;

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
    assert.equal(parsed.spec.endpoints.length, 13);
    assert.deepEqual(parsed.spec.everyKinds, ["unauthenticated", "forbidden", "too_large", "internal"]);
    const applies = Object.fromEntries(parsed.spec.endpoints.map((e) => [`${e.method} ${e.path}`, e.applies]));
    assert.deepEqual(applies["POST /todos"], ["title.length"]);
    assert.deepEqual(applies["PATCH /todos/{id}"], ["patch.nonempty", "title.length"]);
    assert.deepEqual(applies["GET /todos"], []);
    assert.deepEqual(applies["POST /sessions"], ["email.length", "email.shape", "password.given"]);
    assert.equal(applies["GET /health"], undefined);
    const security = Object.fromEntries(parsed.spec.endpoints.map((e) => [`${e.method} ${e.path}`, e.security]));
    assert.equal(security["GET /health"], "anonymous");
    assert.equal(security["GET /sessions/current"], "anonymous");
    assert.equal(security["POST /todos"], "member");
    assert.equal(security["POST /sessions"], "anonymous");
    assert.equal(security["DELETE /sessions/current"], "member");
  });

  it("reads an endpoint's parts and its inline shapes", () => {
    const parsed = parse(
      spec(`
### \`PATCH /todos/{id}\`
Serves: \`use-cases/todos/change-a-todo.md\`.
Applies: \`patch.nonempty\`, \`title.length\`
Security: \`member\`

Path:
- \`id\`: text

Body: \`PatchTodoBody\`, at least 1 field "body must have a field"
- \`title\`: text, optional

Reply: 200 \`Todo\`
- \`id\`: text

Errors: \`validation\`, \`not_found\`

Examples:

Example: renames
Request: \`PATCH /todos/t1\`
\`\`\`json
{ "title": "Buy milk" }
\`\`\`
Reply: 200
\`\`\`json
{ "ok": true, "data": { "id": "t1" } }
\`\`\`

Example: empty
Request: \`PATCH /todos/t1\`
\`\`\`json
{}
\`\`\`
Reply: 422
\`\`\`json
{ "ok": false, "error": { "kind": "validation", "message": "body must have a field", "field": "body" } }
\`\`\`

Example: missing
Request: \`PATCH /todos/t2\`
\`\`\`json
{ "title": "Buy milk" }
\`\`\`
Reply: 404
\`\`\`json
{ "ok": false, "error": { "kind": "not_found", "message": "no todo has id t2" } }
\`\`\`
`),
    );
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    const [endpoint] = parsed.spec.endpoints;
    assert.equal(endpoint?.serves, "`use-cases/todos/change-a-todo.md`");
    assert.deepEqual(endpoint?.applies, ["patch.nonempty", "title.length"]);
    assert.equal(endpoint?.security, "member");
    assert.deepEqual(endpoint?.params.map((param) => param.name), ["id"]);
    assert.equal(endpoint?.body, "PatchTodoBody");
    assert.equal(endpoint?.status, 200);
    assert.deepEqual(endpoint?.errors, ["validation", "not_found"]);
    const body = parsed.spec.shapes.find((shape) => shape.name === "PatchTodoBody");
    assert.ok(body?.kind === "object");
    assert.deepEqual(body.atLeast, { fields: 1, message: "body must have a field" });
    assert.deepEqual(
      endpoint?.examples.map((example) => [example.name, example.status]),
      [
        ["renames", 200],
        ["empty", 422],
        ["missing", 404],
      ],
    );
    assert.deepEqual(endpoint?.examples[2]?.request?.params, { id: "t2" });
    assert.deepEqual(endpoint?.examples[1]?.request?.body, {});
  });

  it("refuses a kind every endpoint already returns", () => {
    const found = problems(spec(getA(works, "`internal`")));
    assert.deepEqual(found, ["kind internal is one every endpoint can return; list only the kinds it adds"]);
  });

  it("refuses a path parameter Path: does not list", () => {
    const found = problems(spec(getA(works.replace("`GET /a`", "`GET /a/1`")).replaceAll("/a`", "/a/{id}`")));
    assert.deepEqual(found, ["GET /a/{id} names {id} in its path but Path: lists none"]);
  });

  it("reads Applies: none as no rules, and no Applies: as undefined", () => {
    const none = parse(spec(getA(works).replace("Serves: x.\n", "Serves: x.\nApplies: none\n")));
    assert.ok(none.ok, JSON.stringify(!none.ok && none.problems));
    assert.deepEqual(none.spec.endpoints[0]?.applies, []);
    const absent = parse(spec(getA(works)));
    assert.ok(absent.ok, JSON.stringify(!absent.ok && absent.problems));
    assert.equal(absent.spec.endpoints[0]?.applies, undefined);
  });

  it("refuses an Applies: that is not rule ids in code font", () => {
    const found = problems(spec(getA(works).replace("Serves: x.\n", "Serves: x.\nApplies: title.length\n")));
    assert.deepEqual(found, ['Applies: is "none" or rule ids in code font, separated by commas']);
  });

  it("refuses an Applies: that names a rule twice", () => {
    const found = problems(
      spec(getA(works).replace("Serves: x.\n", "Serves: x.\nApplies: `title.length`, `title.length`\n")),
    );
    assert.deepEqual(found, ["Applies: names title.length twice"]);
  });

  it("refuses parts out of order", () => {
    const found = problems(spec(`\n### \`GET /a\`\nReply: 200 \`R\`\n- \`ok\`: boolean\n\nServes: x.\nSecurity: \`anonymous\`\n\nErrors: none\n${works}`));
    assert.deepEqual(found, ["Serves: is out of order; the order is Serves, Applies, Security, Path, Query, Body, Reply, Errors, Examples"]);
  });

  it("refuses a shape that is not defined", () => {
    const found = problems(spec(`\n### \`GET /a\`\nServes: x.\nSecurity: \`anonymous\`\n\nReply: 200 \`Missing\`\n\nErrors: none\n${works}`));
    assert.deepEqual(found, ["shape Missing is not defined"]);
  });

  it("refuses a kind not in Errors", () => {
    const found = problems(spec(getA(works, "`limit`")));
    assert.deepEqual(found, ["GET /a has no example of limit", "kind limit is not in Errors"]);
  });

  it("reads what each kind carries beside its message", () => {
    const withReason = spec(getA(works)).replace(
      "- `not_found`: 404\n",
      "- `not_found`: 404\n- `forbidden`: 403, with reason: channel | role\n",
    );
    const parsed = parse(withReason);
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.deepEqual(
      parsed.spec.kinds.map((kind) => [kind.name, kind.carries, kind.reasons]),
      [
        ["validation", "field", []],
        ["not_found", undefined, []],
        ["forbidden", "reason", ["channel", "role"]],
        ["internal", undefined, []],
      ],
    );
  });

  it("refuses a kind that carries anything else", () => {
    const shape = 'an error is "- `kind`: status", "- `kind`: status, with field" or "- `kind`: status, with reason: a | b"';
    const withPath = spec(getA(works)).replace("- `not_found`: 404\n", "- `not_found`: 404, with path\n");
    assert.deepEqual(problems(withPath), [shape]);
    const fieldList = spec(getA(works)).replace("- `validation`: 422, with field\n", "- `validation`: 422, with field: a | b\n");
    assert.deepEqual(problems(fieldList), [shape]);
  });

  it("refuses a reason kind that does not list its reasons, or lists one twice", () => {
    const bare = spec(getA(works)).replace("- `not_found`: 404\n", "- `not_found`: 404\n- `forbidden`: 403, with reason\n");
    assert.deepEqual(problems(bare), ['kind forbidden carries a reason, so it lists them: "with reason: a | b"']);
    const twice = spec(getA(works)).replace(
      "- `not_found`: 404\n",
      "- `not_found`: 404\n- `forbidden`: 403, with reason: role | role-x | role\n",
    );
    assert.deepEqual(problems(twice), [
      `kind forbidden's reason "role-x" is not a name`,
      "kind forbidden lists the reason role twice",
    ]);
  });

  it("refuses a second kind that carries a reason", () => {
    const two = spec(getA(works)).replace(
      "- `not_found`: 404\n",
      "- `not_found`: 404\n- `forbidden`: 403, with reason: role\n- `locked`: 423, with reason: held\n",
    );
    assert.deepEqual(problems(two), ["kind locked carries a reason, and so does forbidden; one kind carries a reason"]);
  });

  it("refuses an example whose reason the kind does not list", () => {
    const refused = `
Examples:

Example: works
Request: \`GET /a\`
Reply: 200
\`\`\`json
{ "ok": true, "data": { "ok": true } }
\`\`\`

Example: refused
Request: \`GET /a\`
Reply: 403
\`\`\`json
{ "ok": false, "error": { "kind": "forbidden", "message": "no", "reason": "role" } }
\`\`\`
`;
    const source = spec(getA(refused, "`forbidden`")).replace(
      "- `not_found`: 404\n",
      "- `not_found`: 404\n- `forbidden`: 403, with reason: channel\n",
    );
    assert.deepEqual(problems(source), ['example "refused" gives the reason role, which is not among channel']);
  });

  it("refuses an endpoint without Security:", () => {
    const found = problems(spec(getA(works).replace("Security: `anonymous`\n", "")));
    assert.deepEqual(found, ['GET /a has no Security:; write "Security: `anonymous`" when anyone may call it']);
  });

  it("refuses a Security: that is not one of access.md's levels", () => {
    const found = problems(spec(getA(works).replace("Security: `anonymous`", "Security: `owner`")));
    assert.deepEqual(found, ["Security: is one of `anonymous`, `member`, `verified_member`, `admin`"]);
  });

  it("refuses an endpoint without Errors:", () => {
    const found = problems(spec(`\n### \`GET /a\`\nServes: x.\nSecurity: \`anonymous\`\n\nReply: 200 \`R\`\n- \`ok\`: boolean\n${works}`));
    assert.deepEqual(found, ['GET /a has no Errors:; write "Errors: none" when it adds none']);
  });

  it("refuses a table row", () => {
    const found = problems(spec(`\n### \`GET /a\`\nServes: x.\nSecurity: \`anonymous\`\n\n| a | b |\n\nReply: 200 \`R\`\n- \`ok\`: boolean\n\nErrors: none\n${works}`));
    assert.equal(found.length, 1);
    assert.match(found[0] ?? "", /^an endpoint holds only/);
  });

  it("reads a shared list shape", () => {
    const parsed = parse(
      spec(
        `\n### \`GET /a\`\nServes: x.\nSecurity: \`anonymous\`\n\nReply: 200 \`TodoList\`\n\nErrors: none\n${works}`,
        "\n### `Todo`\nA todo.\n- `id`: text\n\n### `TodoList`\nlist of `Todo`\n",
      ),
    );
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.deepEqual(parsed.spec.shared, ["Todo", "TodoList"]);
    const list = parsed.spec.shapes.find((shape) => shape.name === "TodoList");
    assert.deepEqual(list, { name: "TodoList", doc: undefined, kind: "list", of: "Todo" });
  });

  it("reads the examples every endpoint shares", () => {
    const parsed = parse(spec(getA(works)));
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.deepEqual(parsed.spec.everyExamples.map((example) => [example.name, example.status, example.request]), [
      ["the server fails", 500, undefined],
    ]);
  });

  it("reads a query string into its keys and values", () => {
    const query = spec(
      "\n### `GET /a`\nServes: x.\nSecurity: `anonymous`\n\nQuery: `Q`\n- `c`: text, optional\n\nReply: 200 `R`\n- `ok`: boolean\n\nErrors: none\n" +
        works.replace("`GET /a`", "`GET /a?c=x%20y&c=z`"),
    );
    const parsed = parse(query);
    assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.problems));
    assert.deepEqual(parsed.spec.endpoints[0]?.examples[0]?.request?.query, [
      ["c", "x y"],
      ["c", "z"],
    ]);
  });

  it("refuses an endpoint without Examples:", () => {
    assert.deepEqual(problems(spec(getA(""))), ["GET /a has no Examples:"]);
  });

  it("refuses an endpoint without an example that succeeds", () => {
    const failing = works.replace('{ "ok": true, "data": { "ok": true } }', '{ "ok": false, "error": { "kind": "internal", "message": "internal error" } }').replace("Reply: 200", "Reply: 500");
    assert.deepEqual(problems(spec(getA(failing))), ["GET /a has no example that succeeds"]);
  });

  it("refuses a success with another status", () => {
    const found = problems(spec(getA(works.replace("Reply: 200", "Reply: 201"))));
    assert.deepEqual(found, ['example "works" replies 201; a success replies 200']);
  });

  it("refuses a failure whose status is not its kind's", () => {
    const wrong = `${works}\nExample: gone\nRequest: \`GET /a\`\nReply: 400\n\`\`\`json\n{ "ok": false, "error": { "kind": "internal", "message": "internal error" } }\n\`\`\`\n`;
    assert.deepEqual(problems(spec(getA(wrong))), ['example "gone" replies 400; internal replies 500']);
  });

  it("refuses a failure of a kind the endpoint cannot return", () => {
    const wrong = `${works}\nExample: gone\nRequest: \`GET /a\`\nReply: 404\n\`\`\`json\n{ "ok": false, "error": { "kind": "not_found", "message": "not found" } }\n\`\`\`\n`;
    assert.deepEqual(problems(spec(getA(wrong))), ['example "gone" fails with not_found, which is not among internal']);
  });

  it("refuses a request that does not match the endpoint", () => {
    const found = problems(spec(getA(works.replace("`GET /a`", "`POST /b`"))));
    assert.deepEqual(found, ['example "works" sends POST; GET /a is GET', 'example "works" sends /b, which does not match /a']);
  });

  it("refuses a body the endpoint does not take", () => {
    const found = problems(spec(getA(works.replace("`GET /a`\n", '`GET /a`\n```json\n{ "x": 1 }\n```\n'))));
    assert.deepEqual(found, ['example "works" sends a body; GET /a takes none']);
  });

  it("refuses a block that is not JSON", () => {
    const found = problems(spec(getA(works.replace('{ "ok": true, "data": { "ok": true } }', "{ ok: true }"))));
    assert.equal(found.length, 2);
    assert.equal(found[0], "GET /a has no example that succeeds");
    assert.match(found[1] ?? "", /^a reply is not JSON/);
  });

  it("refuses a block that is not closed", () => {
    const found = problems(spec(getA(works.replace(/```\n$/, ""))));
    assert.ok(found.some((message) => message === "this ```json block is not closed"), JSON.stringify(found));
  });
});

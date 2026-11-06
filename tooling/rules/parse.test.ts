import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { TITLE_INPUT, TITLE_RULE, spec } from "./fixtures.ts";
import { parse, parseField, parseForm } from "./parse.ts";

const problems = (text: string) => {
  const parsed = parse(text);
  assert.equal(parsed.ok, false, "expected problems");
  return parsed.ok ? [] : parsed.problems.map((problem) => problem.message);
};

describe("parse", () => {
  it("reads the committed spec", () => {
    const parsed = parse(readFileSync("prd/todo/rules.md", "utf8"));
    assert.equal(parsed.ok, true, parsed.ok ? "" : JSON.stringify(parsed.problems));
    if (!parsed.ok) {
      return;
    }
    assert.deepEqual(
      parsed.spec.rules.map((rule) => [rule.id, rule.kind]),
      [
        ["title.length", "input"],
        ["patch.nonempty", "input"],
        ["email.length", "input"],
        ["email.shape", "input"],
        ["password.given", "input"],
        ["todos.cap", "state"],
        ["todo.exists", "state"],
        ["todo.owned", "state"],
        ["todos.order", "guarantee"],
        ["todos.unique_id", "guarantee"],
        ["todos.scoped", "guarantee"],
      ],
    );
    assert.deepEqual(
      parsed.spec.inputs.map((input) => [input.name, input.type ?? `builds ${input.builds}`]),
      [
        ["NewTodo", "todos/todo.ts"],
        ["TodoPatch", "todos/todo.ts"],
        ["TodoFilter", "todos/todo.ts"],
        ["Completed", "builds completed"],
        ["SignIn", "auth/credential.ts"],
      ],
    );
  });

  it("reads an input, its fields and their rules", () => {
    const parsed = parse(spec(TITLE_INPUT, TITLE_RULE));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.deepEqual(parsed.spec.inputs[0], {
      name: "NewTodo",
      doc: "What someone asks to add.",
      area: "todos",
      type: "todos/todo.ts",
      builds: undefined,
      rules: [],
      fields: [{ name: "title", type: "text", trimmed: true, lowerCased: false, optional: false, rules: ["title.length"], line: 22 }],
      line: 16,
    });
    assert.deepEqual(parsed.spec.rules[0]?.violations, [
      { name: "empty", condition: "below" },
      { name: "too_long", condition: "above" },
    ]);
  });

  it("reads a source that wraps", () => {
    const rule = `
### \`todos.order\`
Lists are in order.
Kind: guarantee

Source: DB6, story chapter 8 › every select
orders by \`seq\`.
`;
    const parsed = parse(spec(TITLE_INPUT, TITLE_RULE + rule));
    assert.equal(parsed.ok, true);
    assert.equal(parsed.ok && parsed.spec.rules[1]?.source, "DB6, story chapter 8 › every select orders by `seq`.");
  });

  it("refuses an id that is not <subject>.<property>", () => {
    const rule = "\n### `Todos.Order`\nLists are in order.\nKind: guarantee\n\nSource: DB6.\n";
    assert.match(problems(spec(TITLE_INPUT, TITLE_RULE + rule)).join("\n"), /Todos\.Order is not <subject>\.<property>/);
  });

  it("refuses a rule without a source (L31)", () => {
    const rule = "\n### `todos.order`\nLists are in order.\nKind: guarantee\n";
    assert.match(problems(spec(TITLE_INPUT, TITLE_RULE + rule)).join("\n"), /todos\.order needs Source: \(L31\)/);
  });

  it("refuses a violation whose condition is not its form's", () => {
    const rule = TITLE_RULE.replace("`empty`: below", "`empty`: fewer");
    assert.match(problems(spec(TITLE_INPUT, rule)).join("\n"), /empty needs a condition of its form: below or above/);
  });

  it("refuses a form on a state rule", () => {
    const rule = "\n### `todos.cap`\nThe list has room.\nKind: state\nForm: custom\n\nSource: deviation 9.\n";
    assert.match(problems(spec(TITLE_INPUT, TITLE_RULE + rule)).join("\n"), /only input rules have Form:/);
  });

  it("refuses a field rule that is not defined", () => {
    assert.match(problems(spec(TITLE_INPUT, "")).join("\n"), /title applies title\.length, which is not defined/);
  });

  it("refuses an input rule no input applies", () => {
    const input = TITLE_INPUT.replace("  - `title.length`\n", "");
    assert.match(problems(spec(input, TITLE_RULE)).join("\n"), /title\.length is an input rule no input applies/);
  });

  it("refuses a line the vocabulary does not allow", () => {
    const input = TITLE_INPUT.replace("Fields:", "Applies: `title.length`\n\nFields:");
    assert.match(problems(spec(input, TITLE_RULE)).join("\n"), /an input has no Applies:/);
  });

  it("refuses a modifier on a boolean field", () => {
    const input = TITLE_INPUT.replace("Fields:", "Fields:\n- `done`: boolean, lower-cased");
    assert.match(problems(spec(input, TITLE_RULE)).join("\n"), /done is boolean: only a text field is trimmed or lower-cased/);
  });

  it("refuses an at least rule whose fields the input does not have as optional", () => {
    const input = TITLE_INPUT.replace("Fields:", "Rules:\n- `patch.nonempty`\n\nFields:");
    const rule = "\n### `patch.nonempty`\nSomething.\nKind: input\nForm: at least 1 of `title`\n\nViolations:\n- `empty`: fewer\n\nSource: PRD.\n";
    assert.match(problems(spec(input, TITLE_RULE + rule)).join("\n"), /counts title, which NewTodo needs as an optional field/);
  });
});

describe("parseForm", () => {
  it("reads the three forms", () => {
    assert.deepEqual(parseForm("length, 1 to `max`"), {
      kind: "length",
      least: { kind: "number", value: 1 },
      most: { kind: "parameter", name: "max" },
    });
    assert.deepEqual(parseForm("at least 1 of `title`, `completed`"), {
      kind: "atLeast",
      count: 1,
      fields: ["title", "completed"],
    });
    assert.deepEqual(parseForm("custom"), { kind: "custom" });
    assert.equal(parseForm("between 1 and 3"), undefined);
  });
});

describe("parseField", () => {
  it("reads a field's type, trimmed, lower-cased and optional", () => {
    assert.deepEqual(parseField("`title`: text, trimmed, optional"), {
      name: "title",
      type: "text",
      trimmed: true,
      lowerCased: false,
      optional: true,
    });
    assert.deepEqual(parseField("`email`: text, trimmed, lower-cased"), {
      name: "email",
      type: "text",
      trimmed: true,
      lowerCased: true,
      optional: false,
    });
    assert.deepEqual(parseField("`completed`: boolean"), {
      name: "completed",
      type: "boolean",
      trimmed: false,
      lowerCased: false,
      optional: false,
    });
    assert.equal(parseField("`title`: text, optional, trimmed"), undefined);
    assert.equal(parseField("`email`: text, lower-cased, trimmed"), undefined);
  });
});

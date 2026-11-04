import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Endpoint } from "../api-spec/parse.ts";
import type { RouteRow } from "../entry-chains/routes.ts";
import type { Rule, RuleKind } from "../rules/parse.ts";
import type { UseCase } from "../rules/use-cases.ts";
import { type Inputs, joinProblems, namedBy } from "./join.ts";
import type { TestResult } from "./report.ts";

const rule = (id: string, kind: RuleKind): Rule => ({
  id,
  statement: "",
  kind,
  form: undefined,
  parameters: [],
  violations: [],
  source: "",
  line: 1,
});

const rules = [rule("title.length", "input"), rule("patch.nonempty", "input"), rule("todos.cap", "state"), rule("todos.order", "guarantee")];

const addATodo: UseCase = {
  path: "prd/todo/use-cases/todos/add-a-todo.md",
  title: "Add a todo",
  citations: [
    { id: "title.length", section: "Assumes", line: 7 },
    { id: "todos.cap", section: "Given", line: 12 },
  ],
};

const endpoint = (method: string, path: string, serves: string, applies: string[] | undefined): Endpoint => ({
  method,
  path,
  serves,
  applies,
  params: [],
  query: undefined,
  body: undefined,
  status: 200,
  reply: "R",
  errors: [],
  examples: [],
  line: 40,
});

const health = endpoint("GET", "/health", "`prd/todo.md`, deviation 13", undefined);
const post = endpoint("POST", "/todos", "`use-cases/todos/add-a-todo.md`", ["title.length"]);

const probe: RouteRow = { key: "GET /health", name: "getHealth", unit: null, validator: null };
const postRoute: RouteRow = {
  key: "POST /todos",
  name: "postTodos",
  unit: "addTodo",
  validator: { name: "toNewTodo", rules: ["title.length"] },
};

const passed = (title: string): TestResult => ({ file: "ops/add-todo.test.ts", title, status: "passed" });

/** The inputs that join, with `changed` over them. */
const inputs = (changed: Partial<Inputs> = {}): Inputs => ({
  rules,
  useCases: [addATodo],
  apiPath: "prd/todo/api.md",
  endpoints: [health, post],
  constructPath: "construct.ts",
  routes: [probe, postRoute],
  report: { ok: true, tests: [passed("todos.cap: names a limit failure"), passed("lists every todo")] },
  ...changed,
});

describe("namedBy", () => {
  it("reads the id a test's title starts with", () => {
    assert.equal(namedBy(passed("todos.cap: names a limit failure")), "todos.cap");
    assert.equal(namedBy(passed("todo.exists: names a not_found failure")), "todo.exists");
  });

  it("reads no id from a title that does not start with one", () => {
    assert.equal(namedBy(passed("names a limit failure")), undefined);
    assert.equal(namedBy(passed("todos.cap names a limit failure")), undefined);
    assert.equal(namedBy(passed("Todos: lists")), undefined);
  });
});

describe("joinProblems", () => {
  it("finds none when the specs and the code agree", () => {
    assert.deepEqual(joinProblems(inputs()), []);
  });

  it("compares Applies: with the validator's rules as sets", () => {
    const patch = endpoint("PATCH", "/todos", "`use-cases/todos/add-a-todo.md`", ["patch.nonempty", "title.length"]);
    const route = { ...postRoute, key: "PATCH /todos", validator: { name: "toTodoPatch", rules: ["title.length", "patch.nonempty"] } };
    assert.deepEqual(joinProblems(inputs({ endpoints: [patch], routes: [route] })), []);
  });

  it("refuses a route that runs a unit with no Applies:", () => {
    const found = joinProblems(inputs({ endpoints: [health, { ...post, applies: undefined }] }));
    assert.deepEqual(found, ['prd/todo/api.md:40: POST /todos has no Applies:; write "Applies: none" when it applies none']);
  });

  it("refuses an Applies: on a probe", () => {
    const found = joinProblems(inputs({ endpoints: [{ ...health, applies: [] }, post] }));
    assert.deepEqual(found, ["prd/todo/api.md:40: GET /health is a probe, which applies no rule; write no Applies:"]);
  });

  it("refuses an id that is not a rule, and a rule that is not an input rule", () => {
    const applies = ["title.length", "title.lenght", "todos.cap"];
    const route = { ...postRoute, validator: { name: "toNewTodo", rules: applies } };
    const found = joinProblems(inputs({ endpoints: [health, { ...post, applies }], routes: [probe, route] }));
    assert.deepEqual(found, [
      "prd/todo/api.md:40: POST /todos applies title.lenght, which is not a rule",
      "prd/todo/api.md:40: POST /todos applies todos.cap, which is a state rule; Applies: names input rules",
    ]);
  });

  it("refuses an Applies: that leaves out a rule the use case assumes", () => {
    const route = { ...postRoute, validator: { name: "toNewTodo", rules: [] } };
    const found = joinProblems(inputs({ endpoints: [health, { ...post, applies: [] }], routes: [probe, route] }));
    assert.deepEqual(found, [
      "prd/todo/api.md:40: POST /todos serves prd/todo/use-cases/todos/add-a-todo.md, which assumes title.length, but Applies: does not name it",
    ]);
  });

  it("refuses a Serves: that names no use case the join reads", () => {
    const found = joinProblems(inputs({ endpoints: [health, { ...post, serves: "`use-cases/todos/add-one.md`" }] }));
    assert.deepEqual(found, ["prd/todo/api.md:40: POST /todos serves no use case the join can read; Serves: names one use case's file"]);
  });

  it("refuses a validator that applies a rule Applies: does not name, or leaves out one it does", () => {
    const route = { ...postRoute, validator: { name: "toNewTodo", rules: ["patch.nonempty"] } };
    const found = joinProblems(inputs({ routes: [probe, route] }));
    assert.deepEqual(found, [
      "construct.ts: the route POST /todos is given toNewTodo, which does not apply title.length, but Applies: names it",
      "construct.ts: the route POST /todos is given toNewTodo, which applies patch.nonempty, but Applies: does not name it",
    ]);
  });

  it("refuses an Applies: that names a rule when the route is given no validator", () => {
    const found = joinProblems(inputs({ routes: [probe, { ...postRoute, validator: null }] }));
    assert.deepEqual(found, ["construct.ts: the route POST /todos is given no validator, but Applies: names title.length"]);
  });

  it("refuses a state rule a use case is given with no test named by it", () => {
    const found = joinProblems(inputs({ report: { ok: true, tests: [passed("names a limit failure")] } }));
    assert.deepEqual(found, ['prd/todo/use-cases/todos/add-a-todo.md:12: todos.cap has no test named by it; name one "todos.cap: …"']);
  });

  it("refuses a test named by a state rule that did not pass", () => {
    const failed = { ...passed("todos.cap: names a limit failure"), status: "failed" };
    const found = joinProblems(inputs({ report: { ok: true, tests: [passed("todos.cap: is atomic"), failed] } }));
    assert.deepEqual(found, [
      'prd/todo/use-cases/todos/add-a-todo.md:12: todos.cap: the test "todos.cap: names a limit failure" in ops/add-todo.test.ts is failed, not passed',
    ]);
  });

  it("refuses a test named by an id that is not a state rule", () => {
    const tests = [passed("todos.cap: names a limit failure"), passed("todos.capp: is atomic"), passed("title.length: trims")];
    const found = joinProblems(inputs({ report: { ok: true, tests } }));
    assert.deepEqual(found, [
      'ops/add-todo.test.ts: the test "todos.capp: is atomic" is named by todos.capp, which is not a state rule',
      'ops/add-todo.test.ts: the test "title.length: trims" is named by title.length, which is not a state rule',
    ]);
  });

  it("names a report it cannot read alongside the other problems", () => {
    const found = joinProblems(inputs({ endpoints: [health, { ...post, applies: undefined }], report: { ok: false, problem: "r.json: no test report" } }));
    assert.deepEqual(found, ['prd/todo/api.md:40: POST /todos has no Applies:; write "Applies: none" when it applies none', "r.json: no test report"]);
  });
});

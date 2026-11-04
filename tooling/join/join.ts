// The join (L33): the specs cite rules by id, and the code carries what it
// applies as data, so each citation can be checked against what runs. For
// each endpoint the api spec writes:
//
//   - a route that runs a unit says what it applies, as `Applies:` (none
//     when it applies none); a probe writes no `Applies:`;
//   - each id it names is an input rule of the rules spec;
//   - it applies every rule the use case it serves assumes;
//   - the validator its route is given applies exactly those rules, as sets.
//
// And for each state rule a use case is given, a test named by the rule's
// id, `todos.cap: …`, passed in the unit report. A test named by an id that
// is not a state rule is refused, so a misspelt name does not go unseen.
//
// Every problem is collected, not only the first, so one run names them all.

import { dirname, join, normalize } from "node:path/posix";
import type { Endpoint } from "../api-spec/parse.ts";
import type { RouteRow } from "../entry-chains/routes.ts";
import { ID, type Rule } from "../rules/parse.ts";
import type { UseCase } from "../rules/use-cases.ts";
import type { Report, TestResult } from "./report.ts";

export type Inputs = {
  rules: Rule[];
  useCases: UseCase[];
  apiPath: string;
  endpoints: Endpoint[];
  constructPath: string;
  routes: RouteRow[];
  report: Report;
};

/** The rule id a test is named by, `todos.cap: names …`, or undefined. */
export const namedBy = (test: TestResult) => {
  const head = test.title.split(": ")[0] ?? "";
  return test.title.includes(": ") && ID.test(head) ? head : undefined;
};

/** The ids in `a` that are not in `b`, in `a`'s order. */
const missing = (a: readonly string[], b: readonly string[]) => a.filter((id) => !b.includes(id));

/** The use case an endpoint serves: its one backticked path, read from the api spec's directory. */
const servedPath = (apiPath: string, endpoint: Endpoint) => {
  const paths = [...endpoint.serves.matchAll(/`([^`]+\.md)`/g)].map((match) => match[1] ?? "");
  return paths.length === 1 ? normalize(join(dirname(apiPath), paths[0] ?? "")) : undefined;
};

const checkEndpoint = (inputs: Inputs, endpoint: Endpoint, route: RouteRow, problems: string[]) => {
  const key = `${endpoint.method} ${endpoint.path}`;
  const at = `${inputs.apiPath}:${endpoint.line}: ${key}`;
  if (route.unit === null) {
    if (endpoint.applies !== undefined) {
      problems.push(`${at} is a probe, which applies no rule; write no Applies:`);
    }
    return;
  }
  if (endpoint.applies === undefined) {
    problems.push(`${at} has no Applies:; write "Applies: none" when it applies none`);
    return;
  }
  const applies = endpoint.applies;

  const byId = new Map(inputs.rules.map((rule) => [rule.id, rule]));
  for (const id of applies) {
    const rule = byId.get(id);
    if (rule === undefined) {
      problems.push(`${at} applies ${id}, which is not a rule`);
    } else if (rule.kind !== "input") {
      problems.push(`${at} applies ${id}, which is a ${rule.kind} rule; Applies: names input rules`);
    }
  }

  const path = servedPath(inputs.apiPath, endpoint);
  const useCase = inputs.useCases.find((each) => each.path === path);
  if (useCase === undefined) {
    problems.push(`${at} serves no use case the join can read; Serves: names one use case's file`);
  } else {
    const assumes = useCase.citations.filter((citation) => citation.section === "Assumes").map((citation) => citation.id);
    for (const id of missing(assumes, applies)) {
      problems.push(`${at} serves ${useCase.path}, which assumes ${id}, but Applies: does not name it`);
    }
  }

  const routed = `${inputs.constructPath}: the route ${key}`;
  const validator = route.validator;
  if (validator === null) {
    for (const id of applies) {
      problems.push(`${routed} is given no validator, but Applies: names ${id}`);
    }
    return;
  }
  for (const id of missing(applies, validator.rules)) {
    problems.push(`${routed} is given ${validator.name}, which does not apply ${id}, but Applies: names it`);
  }
  for (const id of missing(validator.rules, applies)) {
    problems.push(`${routed} is given ${validator.name}, which applies ${id}, but Applies: does not name it`);
  }
};

const checkTests = (inputs: Inputs, tests: TestResult[], problems: string[]) => {
  const byId = new Map(inputs.rules.map((rule) => [rule.id, rule]));
  for (const test of tests) {
    const id = namedBy(test);
    const rule = id === undefined ? undefined : byId.get(id);
    if (id !== undefined && rule?.kind !== "state") {
      problems.push(`${test.file}: the test "${test.title}" is named by ${id}, which is not a state rule`);
    }
  }
  for (const useCase of inputs.useCases) {
    for (const citation of useCase.citations.filter((each) => each.section === "Given")) {
      const named = tests.filter((test) => namedBy(test) === citation.id);
      const at = `${useCase.path}:${citation.line}: ${citation.id}`;
      if (named.length === 0) {
        problems.push(`${at} has no test named by it; name one "${citation.id}: …"`);
      }
      for (const test of named.filter((each) => each.status !== "passed")) {
        problems.push(`${at}: the test "${test.title}" in ${test.file} is ${test.status}, not passed`);
      }
    }
  }
};

/** Every way the specs and the code disagree about the rules, or none. */
export const joinProblems = (inputs: Inputs): string[] => {
  const problems: string[] = [];
  const routes = new Map(inputs.routes.map((route) => [route.key, route]));
  for (const endpoint of inputs.endpoints) {
    const route = routes.get(`${endpoint.method} ${endpoint.path}`);
    // An endpoint with no route, or a route with no endpoint, is check:api's.
    if (route !== undefined) {
      checkEndpoint(inputs, endpoint, route, problems);
    }
  }
  if (inputs.report.ok) {
    checkTests(inputs, inputs.report.tests, problems);
  } else {
    problems.push(inputs.report.problem);
  }
  return problems;
};

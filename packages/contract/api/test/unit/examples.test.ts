import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { type Example, everyExamples, examples } from "../../src/examples.ts";
import { type EndpointKey, Failure, KIND_STATUS, endpoints, success } from "../../src/index.ts";

/**
 * What the api's validation makes of a request: the first issue, as the
 * field and message it would reply with, or undefined when the request
 * matches its schemas. This mirrors `apps/api/src/app/handlers/validate.ts`:
 * a query key given twice is refused before the schema, and an issue with no
 * path key names the whole query or body.
 */
const firstIssue = (key: EndpointKey, request: NonNullable<Example["request"]>) => {
  const endpoint: (typeof endpoints)[EndpointKey] = endpoints[key];
  if ("query" in endpoint) {
    const query: Record<string, string> = {};
    for (const [name, value] of request.query) {
      if (name in query) {
        return { field: name, message: `${name} must be given once` };
      }
      query[name] = value;
    }
    const parsed = v.safeParse(endpoint.query, query);
    if (!parsed.success) {
      return issueOf(parsed.issues, "query");
    }
  }
  if ("body" in endpoint) {
    const parsed = v.safeParse(endpoint.body, request.body);
    if (!parsed.success) {
      return issueOf(parsed.issues, "body");
    }
  }
  return undefined;
};

const issueOf = (issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]], whole: string) => {
  const [issue] = issues;
  const key = issue.path?.[0]?.key;
  return { field: typeof key === "string" ? key : whole, message: issue.message };
};

describe("the examples every endpoint shares", () => {
  it.each(everyExamples.map((example) => [example.name, example] as const))("%s is a failure with its kind's status", (_, example) => {
    const reply = v.parse(Failure, example.reply);
    expect(example.status).toBe(KIND_STATUS[reply.error.kind]);
  });
});

const cases = Object.entries(examples).flatMap(([key, list]) =>
  list.map((example) => [`${key}: ${example.name}`, key as EndpointKey, example] as const),
);

describe("each endpoint's examples", () => {
  it.each(cases)("%s matches the contract", (_, key, example) => {
    const endpoint = endpoints[key];
    const request = example.request;
    expect(request).toBeDefined();
    if (request === undefined) {
      return;
    }
    const issue = firstIssue(key, request);

    if (v.is(success(endpoint.reply), example.reply)) {
      // A success: the request passes, and the status is the endpoint's.
      expect(issue).toBeUndefined();
      expect(example.status).toBe(endpoint.status);
      return;
    }

    const reply = v.parse(Failure, example.reply);
    expect(endpoint.errors).toContain(reply.error.kind);
    expect(example.status).toBe(KIND_STATUS[reply.error.kind]);

    if (reply.error.kind !== "validation") {
      // Not found, full and the rest are about state: the request itself is valid.
      expect(issue).toBeUndefined();
      return;
    }
    // A schema issue must be the one the reply names. When the schema passes,
    // the rule is the use case's (an empty title), which only the api can show.
    if (issue !== undefined) {
      expect({ field: reply.error.field, message: reply.error.message }).toEqual(issue);
    }
  });
});

import type { Context } from "hono";
import * as v from "valibot";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type Fail, invalid } from "@todo/fail/fail.ts";

/**
 * The first issue as an `invalid` failure. Its field is the issue's first
 * path key, else `whole`: what the schema was checking, as a whole.
 */
const firstInvalid = (issues: readonly [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]], whole: string) => {
  const [issue] = issues;
  const key = issue.path?.[0]?.key;
  let field = whole;
  if (typeof key === "string") {
    field = key;
  }
  return invalid(field, issue.message);
};

/**
 * Validates the request body against a contract schema: reads it, parses it
 * as JSON, then checks its shape. A body that is not JSON, or does not match,
 * is a returned `invalid` failure, never a throw.
 */
export const validateBody = async <S extends v.GenericSchema>(
  c: Context,
  schema: S,
): Promise<Result<v.InferOutput<S>, Fail<"invalid">>> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return err(invalid("body", "body is not JSON"));
  }
  const parsed = v.safeParse(schema, body);
  if (parsed.success) {
    return ok(parsed.output);
  }
  return err(firstInvalid(parsed.issues, "body"));
};

/**
 * Validates the query string against a contract schema, each key read as
 * text. A key given more than once is refused, not read as its first value,
 * so `?completed=true&completed=false` cannot pass as `true`. A query that
 * does not match is a returned `invalid` failure, never a throw.
 */
export const validateQuery = <S extends v.GenericSchema>(
  c: Context,
  schema: S,
): Result<v.InferOutput<S>, Fail<"invalid">> => {
  const query: Record<string, string> = {};
  for (const [key, values] of Object.entries(c.req.queries())) {
    const [value, ...more] = values;
    if (value === undefined || more.length > 0) {
      return err(invalid(key, `${key} must be given once`));
    }
    query[key] = value;
  }
  const parsed = v.safeParse(schema, query);
  if (parsed.success) {
    return ok(parsed.output);
  }
  return err(firstInvalid(parsed.issues, "query"));
};

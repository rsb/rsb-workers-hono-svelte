import type { Context } from "hono";
import * as v from "valibot";
import { type Result, err, ok } from "@todo/business/result.ts";
import { type Fail, invalid } from "@todo/fail/fail.ts";

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
  const [issue] = parsed.issues;
  const key = issue.path?.[0]?.key;
  let field = "body";
  if (typeof key === "string") {
    field = key;
  }
  return err(invalid(field, issue.message));
};

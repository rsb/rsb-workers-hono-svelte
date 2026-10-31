import type { Context } from "hono";
import * as v from "valibot";
import { type Result, err, ok } from "@todo/business/result.ts";

/** Why input was rejected: the field to name in the envelope, and a message. */
export type Invalid = { field: string; message: string };

/**
 * Reads the body as JSON and parses it with a contract schema. A body that
 * is not JSON, or does not match, is a returned `Invalid`, never a throw.
 */
export const readJson = async <S extends v.GenericSchema>(
  c: Context,
  schema: S,
): Promise<Result<v.InferOutput<S>, Invalid>> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return err({ field: "body", message: "body is not JSON" });
  }
  const parsed = v.safeParse(schema, body);
  if (parsed.success) return ok(parsed.output);
  const [issue] = parsed.issues;
  const key = issue.path?.[0]?.key;
  return err({ field: typeof key === "string" ? key : "body", message: issue.message });
};

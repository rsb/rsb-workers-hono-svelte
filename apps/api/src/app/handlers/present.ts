import type { ErrorKind } from "@todo/contract-api";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const status = {
  validation: 422,
  not_found: 404,
  limit: 409,
  too_large: 413,
  internal: 500,
} as const satisfies Record<ErrorKind, ContentfulStatusCode>;

/** The success envelope. */
export const success = <T>(c: Context, data: T, code: ContentfulStatusCode = 200) =>
  c.json({ ok: true, data }, code);

/** The error envelope, with the status that belongs to its kind. */
export function failure(
  c: Context,
  kind: Exclude<ErrorKind, "validation">,
  message: string,
): Response;
export function failure(c: Context, kind: "validation", message: string, field: string): Response;
export function failure(c: Context, kind: ErrorKind, message: string, field?: string): Response {
  const error = field === undefined ? { kind, message } : { kind, message, field };
  return c.json({ ok: false, error }, status[kind]);
}

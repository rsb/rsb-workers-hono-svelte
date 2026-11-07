// Generated from prd/todo/api.md by tooling/api-spec/generate.ts. Do not edit: change the spec and regenerate.
import * as v from "valibot";

/** Every kind an API error can have (PRD, Envelope). */
export const ErrorKind = v.picklist(["validation", "unauthenticated", "invalid_credentials", "forbidden", "not_found", "limit", "too_large", "internal"]);
export type ErrorKind = v.InferOutput<typeof ErrorKind>;

/** The kinds that carry a `field`. */
export const FieldKind = v.picklist(["validation"]);
export type FieldKind = v.InferOutput<typeof FieldKind>;

/** The kinds that carry a `reason`. */
export const ReasonKind = v.picklist(["forbidden"]);
export type ReasonKind = v.InferOutput<typeof ReasonKind>;

/** Every `reason` the kind that carries one can give. */
export const Reason = v.picklist(["channel", "account_disabled", "role"]);
export type Reason = v.InferOutput<typeof Reason>;

/** The kinds that carry neither. */
export const OtherKind = v.picklist(["unauthenticated", "invalid_credentials", "not_found", "limit", "too_large", "internal"]);
export type OtherKind = v.InferOutput<typeof OtherKind>;

/** The kinds every endpoint can return, before the ones it adds. */
export const EVERY_KINDS = ["unauthenticated", "forbidden", "too_large", "internal"] as const satisfies readonly ErrorKind[];

/** The HTTP status each kind replies with. */
export const KIND_STATUS = {
  validation: 422,
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden: 403,
  not_found: 404,
  limit: 409,
  too_large: 413,
  internal: 500,
} as const satisfies Record<ErrorKind, number>;

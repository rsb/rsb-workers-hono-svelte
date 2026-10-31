import * as v from "valibot";

/** Every kind an API error can have (PRD, Envelope). */
export const ErrorKind = v.picklist([
  "validation",
  "not_found",
  "limit",
  "too_large",
  "internal",
]);
export type ErrorKind = v.InferOutput<typeof ErrorKind>;

/** `field` is present when the kind is `validation`, and only then. */
export const ApiError = v.variant("kind", [
  v.strictObject({
    kind: v.literal("validation"),
    message: v.string(),
    field: v.string(),
  }),
  v.strictObject({
    kind: v.picklist(["not_found", "limit", "too_large", "internal"]),
    message: v.string(),
  }),
]);
export type ApiError = v.InferOutput<typeof ApiError>;

export const Failure = v.strictObject({
  ok: v.literal(false),
  error: ApiError,
});
export type Failure = v.InferOutput<typeof Failure>;

/** The success envelope around a reply's data schema. */
export const success = <T extends v.GenericSchema>(data: T) =>
  v.strictObject({ ok: v.literal(true), data });

/** Either envelope, for a reply's data schema. */
export const envelope = <T extends v.GenericSchema>(data: T) =>
  v.variant("ok", [success(data), Failure]);

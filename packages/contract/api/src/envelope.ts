import * as v from "valibot";
import { FieldKind, OtherKind } from "./kinds.ts";

/** `field` is present when the kind is `validation`, and only then. */
export const ApiError = v.variant("kind", [
  v.strictObject({
    kind: FieldKind,
    message: v.string(),
    field: v.string(),
  }),
  v.strictObject({
    kind: OtherKind,
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

/** The success envelope around a reply's data type. */
export type Success<T> = { ok: true; data: T };

/** Either envelope, for a reply's data type. */
export type Envelope<T> = Success<T> | Failure;

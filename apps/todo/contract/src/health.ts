import * as v from "valibot";

/** The data of `GET /health`. */
export const HealthReply = v.strictObject({ ok: v.literal(true) });
export type HealthReply = v.InferOutput<typeof HealthReply>;

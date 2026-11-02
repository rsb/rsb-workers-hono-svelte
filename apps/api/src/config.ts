import { type Result, err, ok } from "@todo/business/result.ts";
import * as v from "valibot";

/** Every environment value the api reads, in our own shape. Frozen: it changes only with a deploy. */
export type Config = Readonly<{ db: D1Database }>;

/** A D1 binding, by the two methods the store and a batch need. */
const isD1 = (value: unknown): value is D1Database =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { prepare?: unknown }).prepare === "function" &&
  typeof (value as { batch?: unknown }).batch === "function";

const DB_MESSAGE = "DB is missing or is not a D1 binding";

// The object's own message covers a missing key; the custom one, a wrong value.
const Env = v.object({ DB: v.custom<D1Database>(isD1, DB_MESSAGE) }, DB_MESSAGE);

/**
 * Checks every environment value and builds the config. Takes the env as an
 * argument, so nothing here reads the runtime; only `index.ts` does (DB5).
 */
export const readConfig = (env: unknown): Result<Config, string> => {
  const parsed = v.safeParse(Env, env);
  if (!parsed.success) return err(parsed.issues.map((issue) => issue.message).join("; "));
  return ok(Object.freeze({ db: parsed.output.DB }));
};

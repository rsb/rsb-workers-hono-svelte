import { type Result, err, ok } from "@todo/business/result.ts";
import type { AnyFail } from "@todo/fail/fail.ts";
import { classify } from "./classify.ts";

// The only code that runs a D1 statement. D1 throws on every error, so each
// helper catches it here and returns it classified, named by `context`.
//
// Each helper takes a function that builds the statement, not the statement:
// D1 can throw while binding (a value it cannot store), and building inside
// the `try` means that error is classified like any other.

/** Runs a statement that reads rows, and returns all of them. */
export const queryAll = async <Row>(
  statement: () => D1PreparedStatement,
  context: string,
): Promise<Result<Row[], AnyFail>> => {
  try {
    const prepared = statement();
    const { results } = await prepared.all<Row>();
    return ok(results);
  } catch (cause) {
    return err(classify(cause, context));
  }
};

/** Runs a statement that writes, and returns how many rows it changed. */
export const execute = async (
  statement: () => D1PreparedStatement,
  context: string,
): Promise<Result<number, AnyFail>> => {
  try {
    const prepared = statement();
    const { meta } = await prepared.run();
    return ok(meta.changes);
  } catch (cause) {
    return err(classify(cause, context));
  }
};

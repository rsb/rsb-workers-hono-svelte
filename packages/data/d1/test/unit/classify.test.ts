import { describe, expect, it } from "vitest";
import { classify } from "../../src/classify.ts";

const kindOf = (message: string) => classify(new Error(message), "query").kind;

describe("classify", () => {
  it.each([
    "D1_ERROR: Network connection lost.",
    "D1_ERROR: D1 DB reset because its code was updated.",
    "D1_ERROR: Internal error while starting up D1 DB storage caused object to be reset.",
    "D1_ERROR: Internal error in D1 DB storage caused object to be reset.",
    "D1_ERROR: D1 DB storage operation exceeded timeout which caused object to be reset.",
    "D1_ERROR: Cannot resolve D1 DB due to transient issue on remote node.",
    "D1_ERROR: Replica disconnected from primary.",
    "D1_ERROR: D1 DB is overloaded. Requests queued for too long.",
    "D1_ERROR: D1 DB is overloaded. Too many requests queued.",
    "D1_ERROR: Can't read from request stream because client disconnected.",
  ])("calls a passing error unavailable: %s", (message) => {
    expect(kindOf(message)).toBe("unavailable");
  });

  it.each([
    "D1_ERROR: Exceeded maximum DB size.",
    "D1_ERROR: Your account has exceeded D1's maximum account storage limit.",
    "D1_ERROR: Your account has exceeded D1's free tier daily row read limit.",
    "D1_ERROR: Your account has exceeded D1's free tier daily row write limit.",
  ])("calls a quota unavailable: %s", (message) => {
    expect(kindOf(message)).toBe("unavailable");
  });

  it.each([
    "D1_ERROR: no such table: todos: SQLITE_ERROR",
    "D1_ERROR: UNIQUE constraint failed: todos.id: SQLITE_CONSTRAINT",
    "D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'",
    "D1_EXEC_ERROR: Error in line 1: near \"SELEC\": syntax error",
    "D1_ERROR: D1 DB exceeded its CPU time limit and was reset.",
    "something nobody has seen before",
  ])("calls anything else a server fault: %s", (message) => {
    expect(kindOf(message)).toBe("server");
  });

  it("keeps the D1 error as the cause, with the context in the message", () => {
    const d1 = new Error("D1_ERROR: Network connection lost.");

    const fail = classify(d1, "add unless full");

    expect(fail.message).toBe("add unless full: D1_ERROR: Network connection lost.");
    expect(fail.cause).toBe(d1);
  });
});

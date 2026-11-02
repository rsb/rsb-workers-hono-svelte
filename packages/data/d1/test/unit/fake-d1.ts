/** What one prepared statement was given: its SQL and the values bound to it. */
export type Prepared = { sql: string; bound: unknown[] };

/** How the fake answers: the rows `all` returns, the changes `run` reports, or an error to throw. */
export type Answer = {
  rows?: unknown[];
  changes?: number;
  throws?: Error;
  throwsOnBind?: Error;
};

/**
 * A fake `D1Database` with only `prepare`, recording every statement. It
 * proves what we send to D1 and how we read its answer, never that the SQL
 * is right: the SQL is proven against a real D1 (integration, still open).
 */
export const fakeD1 = (answer: Answer = {}) => {
  const prepared: Prepared[] = [];

  const prepare = (sql: string) => {
    const record: Prepared = { sql, bound: [] };
    prepared.push(record);

    const statement = {
      bind: (...values: unknown[]) => {
        if (answer.throwsOnBind) {
          throw answer.throwsOnBind;
        }
        record.bound = values;
        return statement;
      },
      all: async () => {
        if (answer.throws) {
          throw answer.throws;
        }
        return { success: true, meta: {}, results: answer.rows ?? [] };
      },
      run: async () => {
        if (answer.throws) {
          throw answer.throws;
        }
        return { success: true, meta: { changes: answer.changes ?? 0 }, results: [] };
      },
    };
    return statement;
  };

  // The fake has only what our code calls, so it is cast to the full type.
  const db = { prepare } as unknown as D1Database;
  return { db, prepared };
};

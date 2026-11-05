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
 * A fake `D1Database` with only `prepare` and `batch`, recording every
 * statement, for each batch how many statements it ran, and each round trip
 * to D1: an `all` or a `run` outside a batch is one trip of one statement,
 * a `batch` is one trip of as many statements as it holds. A trip is
 * recorded even when D1 throws: the call still went out. It
 * proves what we send to D1 and how we read its answer, never that the SQL
 * is right: the SQL is proven against a real D1 (integration, still open).
 */
export const fakeD1 = (answer: Answer = {}) => {
  const prepared: Prepared[] = [];
  const batches: number[] = [];
  // One entry per round trip, holding how many statements it carried.
  const trips: number[] = [];

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
        trips.push(1);
        if (answer.throws) {
          throw answer.throws;
        }
        return { success: true, meta: {}, results: answer.rows ?? [] };
      },
      run: async () => {
        trips.push(1);
        if (answer.throws) {
          throw answer.throws;
        }
        return { success: true, meta: { changes: answer.changes ?? 0 }, results: [] };
      },
    };
    return statement;
  };

  // Every statement in a batch answers alike: the rows and the changes.
  const batch = async (statements: unknown[]) => {
    trips.push(statements.length);
    if (answer.throws) {
      throw answer.throws;
    }
    batches.push(statements.length);
    return statements.map(() => ({
      success: true,
      meta: { changes: answer.changes ?? 0 },
      results: answer.rows ?? [],
    }));
  };

  // The fake has only what our code calls, so it is cast to the full type.
  const db = { prepare, batch } as unknown as D1Database;
  return { db, prepared, batches, trips };
};

/**
 * The log port (L38): where the api writes what a developer reads later,
 * never the caller. One entry is one JSON line on the Worker's log, and the
 * `requestId` gate binds each request's log to its id, so every line of a
 * request can be found from one.
 */
export type Log = { error(entry: Record<string, unknown>): void };

/** The log for one request: `requestId` is null only before the gate has run, as in a handler's unit test. */
export const consoleLog = (requestId: string | null): Log => ({
  error: (entry) => {
    console.error(JSON.stringify({ requestId, ...entry }));
  },
});

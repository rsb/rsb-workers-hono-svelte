/**
 * The log port (L38), as an operation sees it: where an operation records
 * a fault it recovered from, which the caller is never told. The delivery
 * passes the log bound to the request, so each entry carries the request
 * id. Entries hold kinds and messages, never a secret.
 */
export type Log = { error(entry: Record<string, unknown>): void };

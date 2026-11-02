import { type Fail, serverFault, unavailable } from "@todo/fail/fail.ts";

/**
 * D1 throws a plain `Error` whose message is the only clue: a prefix such as
 * `D1_ERROR:` and then text, with no code. These are the texts Cloudflare
 * documents (Debug D1) as passing: trying again later may work.
 */
const TRANSIENT = [
  "Network connection lost",
  "D1 DB reset because its code was updated",
  "caused object to be reset",
  "Cannot resolve D1 DB due to transient issue",
  "Replica disconnected from primary",
  "D1 DB is overloaded",
  "client disconnected",
];

/** A storage or daily limit of the account. It passes, but only with time or an operator. */
const QUOTA = [
  "Exceeded maximum DB size",
  "exceeded D1's maximum account storage limit",
  "exceeded D1's free tier daily row",
];

const matches = (message: string, texts: readonly string[]) => {
  return texts.some((text) => message.includes(text));
};

/**
 * Decides which failure a D1 error is. Anything not recognised is a server
 * fault: our own bugs (bad SQL, a missing table, a broken constraint) land
 * there too. The D1 error stays the cause, so the log keeps all of it.
 */
export const classify = (cause: unknown, context: string): Fail<"unavailable"> | Fail<"server"> => {
  const text = cause instanceof Error ? cause.message : String(cause);
  const message = `${context}: ${text}`;

  if (matches(text, TRANSIENT)) {
    return unavailable(message, cause);
  }

  if (matches(text, QUOTA)) {
    return unavailable(message, cause);
  }

  return serverFault(message, cause);
};

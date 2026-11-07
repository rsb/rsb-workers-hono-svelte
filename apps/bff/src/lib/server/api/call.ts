import { type Envelope, type Failure, envelope } from "@todo/contract-api";
import * as v from "valibot";

/**
 * A call with a JSON body, saying so: the api's `channel` gate refuses a
 * body of any other type on a request that is not bearer (L38, L49), and a
 * string body is otherwise sent as `text/plain`.
 */
export const json = (method: "POST" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Any reply the BFF cannot read is, to the page, an internal error. */
const unreadable: Failure = {
  ok: false,
  error: { kind: "internal", message: "the API could not be reached" },
};

/**
 * Calls the API through its binding and reads the envelope with a contract
 * schema. The body decides, not the status. Every failure is a returned
 * `Failure`, never a throw.
 */
export async function call<S extends v.GenericSchema>(
  api: Pick<Fetcher, "fetch">,
  path: string,
  init: RequestInit,
  data: S,
): Promise<Envelope<v.InferOutput<S>>> {
  let response: Response;
  try {
    response = await api.fetch(`https://todo-api${path}`, init);
  } catch {
    return unreadable;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unreadable;
  }

  const parsed = v.safeParse(envelope(data), body);
  // The cast is safe: the schema is exactly `Envelope`. TypeScript cannot
  // reduce valibot's object output while `S` is still generic (findings 02).
  return parsed.success ? (parsed.output as Envelope<v.InferOutput<S>>) : unreadable;
}

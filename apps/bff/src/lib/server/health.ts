import { HealthReply, envelope } from "@todo/contract-api";
import * as v from "valibot";

export type Health = { api: "up" | "down" };

const HealthEnvelope = envelope(HealthReply);
const down: Health = { api: "down" };

/** Asks the API through its binding; every failure is a returned `down`. */
export async function readHealth(api: Pick<Fetcher, "fetch">): Promise<Health> {
  let response: Response;
  try {
    response = await api.fetch("https://todo-api/health");
  } catch {
    return down;
  }
  if (!response.ok) return down;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return down;
  }
  if (!v.is(HealthEnvelope, body) || !body.ok) return down;

  return { api: "up" };
}

import { SessionReply } from "@todo/contract-api";
import { call } from "./call.ts";

/**
 * `GET /sessions/current`: who the request acts for, with the name and
 * email the frame shows, and whether the cookie it carried names no live
 * session and should be deleted.
 */
export const getCurrentSession = (api: Pick<Fetcher, "fetch">) => call(api, "/sessions/current", {}, SessionReply);

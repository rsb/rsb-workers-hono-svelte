import { SessionReply, type SignInBody, SignedInReply, SignedOutReply } from "@todo/contract-api";
import { call, json } from "./call.ts";

type Api = Pick<Fetcher, "fetch">;

/**
 * `GET /sessions/current`: who the request acts for, with the name and
 * email the frame shows, and whether the cookie it carried names no live
 * session and should be deleted.
 */
export const getCurrentSession = (api: Api) => call(api, "/sessions/current", {}, SessionReply);

/**
 * `POST /sessions`: sign in. The raw token of the new session and its
 * absolute expiry, which the BFF stores as the session cookie; the api
 * never writes `Set-Cookie` (L40).
 */
export const postSession = (api: Api, body: SignInBody) => call(api, "/sessions", json("POST", body), SignedInReply);

/**
 * `DELETE /sessions/current`: sign out, ending the session the request
 * presents. The BFF deletes its own cookie; the api never writes
 * `Set-Cookie` (L40).
 */
export const deleteCurrentSession = (api: Api) => call(api, "/sessions/current", { method: "DELETE" }, SignedOutReply);

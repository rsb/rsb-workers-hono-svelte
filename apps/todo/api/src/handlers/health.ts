import type { Context } from "hono";
import { success } from "../respond.ts";

export const getHealth = (c: Context) => success(c, { ok: true });

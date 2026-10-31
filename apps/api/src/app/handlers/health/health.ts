import type { Context } from "hono";
import { success } from "../present.ts";

export const getHealth = (c: Context) => success(c, { ok: true });

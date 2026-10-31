import type { Context } from "hono";
import { failure } from "../respond.ts";

export const tooLarge = (c: Context) => failure(c, "too_large", "request body too large");

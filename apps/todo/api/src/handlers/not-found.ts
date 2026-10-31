import type { NotFoundHandler } from "hono";
import { failure } from "../respond.ts";

export const notFound: NotFoundHandler = (c) => failure(c, "not_found", "not found");

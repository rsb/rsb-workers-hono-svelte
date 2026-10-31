import { Hono } from "hono";
import { getHealth } from "../handlers/health.ts";

export const health = new Hono().get("/health", getHealth);

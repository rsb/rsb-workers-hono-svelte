import { describe, expect, it } from "vitest";
import { FAILED, NOT_FOUND, shellError } from "../../../src/lib/shell/views.ts";

describe("shellError, the one funnel handleError runs every error through", () => {
  it("gives SvelteKit's own 404 the not_found view", () => {
    const framework = shellError({ kind: "framework", error: { status: 404, message: "Not Found" } });
    expect(framework).toEqual({ status: 404, message: NOT_FOUND.title, view: NOT_FOUND });
  });

  it("gives the app's error() the view for its status, not the words it was thrown with", () => {
    const app = shellError({ kind: "app", error: { status: 500, message: "for developers", view: NOT_FOUND } });
    expect(app).toEqual({ status: 500, message: FAILED.title, view: FAILED });
  });

  it("gives a validation error the failed view, keeping its 400", () => {
    const validation = shellError({ kind: "validation", error: { status: 400, message: "Bad Request" }, issues: [] });
    expect(validation).toEqual({ status: 400, message: FAILED.title, view: FAILED });
  });

  it("makes a fault a 500 with the failed view, and lets none of its words out", () => {
    const fault = shellError({ kind: "unknown", error: new Error("D1_ERROR: no such table") });
    expect(fault).toEqual({ status: 500, message: FAILED.title, view: FAILED });
  });
});

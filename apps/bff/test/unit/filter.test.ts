import { expect, it } from "vitest";
import { toFilterSegment } from "../../src/lib/filter.ts";

// The route's matcher: a segment it refuses matches no route, so it is a 404.
it("matches only active and completed", () => {
  expect(toFilterSegment("active")).toBe("active");
  expect(toFilterSegment("completed")).toBe("completed");
  expect(toFilterSegment("all")).toBeUndefined();
  expect(toFilterSegment("foo")).toBeUndefined();
  expect(toFilterSegment("Active")).toBeUndefined();
});

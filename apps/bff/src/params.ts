import { defineParams } from "@sveltejs/kit/params";
import { toFilterSegment } from "#lib/filter.ts";

/**
 * Route param matchers. `filter` matches only `active` and `completed`, so
 * `/all` or `/foo` matches no route and is a 404.
 */
export const params = defineParams({
  filter: toFilterSegment,
});

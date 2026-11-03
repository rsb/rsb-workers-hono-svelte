/**
 * Which todos the page lists: every todo at `/`, the active ones at
 * `/active`, the completed ones at `/completed` (deviation 4). Shared by the
 * server, which loads by it, and the footer, which marks the current link.
 */
export type Filter = "all" | "active" | "completed";

/** A path segment that names a filter. `all` has none: it is `/`. */
export type FilterSegment = Exclude<Filter, "all">;

/** The segment as a filter, or `undefined` when it names none (a 404). */
export const toFilterSegment = (segment: string): FilterSegment | undefined => {
  if (segment === "active" || segment === "completed") {
    return segment;
  }
  return undefined;
};

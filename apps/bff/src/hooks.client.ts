import type { HandleClientError } from "@sveltejs/kit/hooks";
import { shellError } from "#lib/shell/views.ts";

/**
 * An error raised while navigating in the browser (a 404 for a path no
 * route has, or a fault) gets its view from the same funnel as the
 * server's. One the server already handled is not passed here again.
 */
export const handleError: HandleClientError = (caught) => shellError(caught);

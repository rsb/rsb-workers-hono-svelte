import type { ErrorView } from "#lib/shell/views.ts";

declare global {
  namespace App {
    /** Every error, as `handleError` leaves it: its status and the view to draw (`shellError`). */
    interface Error {
      status: number;
      message: string;
      view: ErrorView;
    }

    interface Locals {
      /** The `API` binding, forwarding this request's session (`src/hooks.server.ts`). */
      api: Pick<Fetcher, "fetch">;
    }
  }
}

export {};

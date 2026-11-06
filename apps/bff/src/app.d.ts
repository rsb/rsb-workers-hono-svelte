declare global {
  namespace App {
    interface Locals {
      /** The `API` binding, forwarding this request's session (`src/hooks.server.ts`). */
      api: Pick<Fetcher, "fetch">;
    }
  }
}

export {};

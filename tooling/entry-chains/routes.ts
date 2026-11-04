// Reads an api's route table from its construct, as data (L24, L26). It
// builds the routes with a store that is never called, and keeps only what
// each route says about itself: its key, its entry point's name and its unit.
// This is the one extractor that feeds both the OpenAPI document's
// `operationId` and `x-unit` and `apps/api/entry-chains.md`.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** One route: its key as the spec writes it, its entry point, and its unit or `null` for a probe. */
export type RouteRow = { key: string; name: string; unit: string | null };

type Construct = {
  constructOperations: (infra: { dbStore: unknown; newId: () => string }) => unknown;
  constructRoutes: (operations: unknown) => Record<string, { name: string; unit: string | null }>;
};

/** A store whose every method fails when called: building routes calls none. */
const unusedStore = new Proxy(
  {},
  {
    get: (_, method) => () => {
      throw new Error(`entry-chains: the store's ${String(method)} was called while reading the routes`);
    },
  },
);

/**
 * The routes of the construct at `constructPath`, in the order construct
 * lists them. Construct imports the generated contract, so the contract on
 * disk is the one it reads.
 */
export const readRoutes = async (constructPath: string): Promise<RouteRow[]> => {
  const url = pathToFileURL(resolve(constructPath)).href;
  const construct = (await import(url)) as Construct;
  const infra = { dbStore: unusedStore, newId: () => "" };
  const operations = construct.constructOperations(infra);
  const routes = construct.constructRoutes(operations);

  const rows: RouteRow[] = [];
  for (const [key, route] of Object.entries(routes)) {
    rows.push({ key, name: route.name, unit: route.unit });
  }
  return rows;
};

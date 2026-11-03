import type { ErrorKind } from "@todo/contract-api";

/** The BFF's own status for each kind the API can answer with (PRD, Envelope). */
export const status = (kind: ErrorKind): number => {
  switch (kind) {
    case "validation":
      return 422;
    case "not_found":
      return 404;
    case "limit":
      return 409;
    case "too_large":
      return 413;
    case "internal":
      return 500;
  }
};

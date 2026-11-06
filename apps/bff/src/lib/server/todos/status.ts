import type { ErrorKind } from "@todo/contract-api";

/** The BFF's own status for each kind the API can answer with (PRD, Envelope). */
export const status = (kind: ErrorKind): number => {
  switch (kind) {
    case "validation":
      return 422;
    // Interim: the BFF sends no session yet, so the api refuses neither of
    // these to it. The shell's error view (stage 23, commit 10) replaces
    // how the two are answered.
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
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

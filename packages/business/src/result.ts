/**
 * An outcome as a value. Every failure on the request path is returned: the
 * package that first meets an error catches and names it. Only a bug throws.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

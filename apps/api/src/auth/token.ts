import { base64url } from "./base64url.ts";

/**
 * A new raw session token (L40): 32 random bytes from the platform's
 * CSPRNG, base64url without padding, so the 43 characters `TOKEN_PATTERN`
 * takes. Only the caller ever holds it; the store keeps its SHA-256.
 */
export const newToken = (): string => base64url(crypto.getRandomValues(new Uint8Array(32)));

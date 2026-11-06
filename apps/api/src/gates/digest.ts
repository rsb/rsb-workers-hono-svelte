/**
 * A raw session token as the identity store keeps it: SHA-256, in lower-case
 * hex (L40). The raw token never reaches the store.
 */
export const sha256Hex = async (token: string): Promise<string> => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

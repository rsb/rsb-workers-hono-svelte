/** Bytes as base64url without padding: a session token's alphabet, and the hasher's keyed input. */
export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

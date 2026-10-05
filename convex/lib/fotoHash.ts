import { Base64 } from "convex/values";

/** Docs describe hex, while the observed _storage system table returns base64.
 * Compare the same 32 digest bytes; reject malformed and noncanonical input. */
export function fotoHashHex(hash: string): string | null {
  if (/^[a-f0-9]{64}$/i.test(hash)) return hash.toLowerCase();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(hash)) return null;
  const bytes = Base64.toByteArray(hash);
  if (bytes.length !== 32 || Base64.fromByteArray(bytes) !== hash) return null;
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export function fotoHashGelijk(opslagHash: string, ticketHex: string): boolean {
  return /^[a-f0-9]{64}$/i.test(ticketHex) && fotoHashHex(opslagHash) === ticketHex.toLowerCase();
}

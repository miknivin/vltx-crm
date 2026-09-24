import Hashids from "hashids";

/// The enquiry's staff/customer-facing reference (e.g. "9G2XQ7VK") is an
/// obfuscated encoding of its internal, sequence-backed `reference` column —
/// not a value stored anywhere itself. This keeps the guarantee a plain
/// incrementing integer gives (the database sequence can never hand out a
/// duplicate) while not showing a seller "you are our 3rd enquiry ever" or
/// letting one guess a neighbouring enquiry's number by counting up or down.
///
/// The salt only needs to be *some* fixed string, not a secret — it just
/// needs to stay the same forever, since changing it would make every
/// previously-issued reference code decode to a different number.
const hashids = new Hashids("vltx-enquiry-reference", 8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789");

export function encodeReference(sequence: number): string {
  return hashids.encode(sequence);
}

/// Returns null for anything that isn't a validly-encoded reference — Hashids
/// throws on a character outside its alphabet rather than returning an empty
/// result, so a caller can otherwise fall back to "no match" instead of
/// querying with garbage.
export function decodeReference(code: string): number | null {
  try {
    const [decoded] = hashids.decode(code.trim().toUpperCase());
    return typeof decoded === "number" ? decoded : null;
  } catch {
    return null;
  }
}

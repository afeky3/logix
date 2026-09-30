/** Converts a Buffer/string to the plain Uint8Array Prisma's `Bytes` fields
 * expect. Copies into a freshly allocated buffer — `new Uint8Array(buf)`
 * would inherit Buffer's ArrayBufferLike generic and fail Prisma's stricter
 * `Uint8Array<ArrayBuffer>` typing. */
export function toBytes(value: Buffer | string): Uint8Array<ArrayBuffer> {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  const out = new Uint8Array(new ArrayBuffer(buf.length));
  out.set(buf);
  return out;
}

/** Converts a Prisma `Bytes` value back to a UTF-8 string (for argon2 PHC hashes). */
export function bytesToUtf8(value: Uint8Array): string {
  return Buffer.from(value).toString('utf8');
}

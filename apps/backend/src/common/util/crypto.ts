import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Application-level AES-256-GCM for at-rest fields that need real
 * encryption today (IBANs) but don't yet have a KMS/secrets setup to
 * envelope-encrypt properly (see staff-auth.service.ts TODO for the same
 * gap on `totp_secret_enc`). `ENCRYPTION_KEY` is a 32-byte key, base64.
 *
 * Layout: `iv(12) || authTag(16) || ciphertext`, all in one Buffer.
 */
export function encryptField(plaintext: string, keyB64: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptField(blob: Buffer, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64');
  const iv = blob.subarray(0, 12);
  const authTag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/** Deterministic fingerprint for lookup/uniqueness without decrypting (e.g.
 * detecting whether an IBAN is already on file). Not reversible. */
export function fingerprint(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

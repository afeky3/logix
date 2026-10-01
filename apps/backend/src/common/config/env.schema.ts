import { z } from 'zod';

/**
 * Validated environment. Fails fast on boot if anything required is missing
 * or malformed — see backend/md/02-architecture.md §9 (Environments).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['local', 'dev', 'staging', 'prod']).default('local'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().min(0).default(1),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_KEY_PREFIX: z.string().default('logix:'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Non-prod OTP: every phone accepts this code, no SMS provider needed yet
  // (T-04 open). See backend/md/modules/01-auth-identity.md §Business rules.
  OTP_TEST_CODE: z.string().length(6).default('123456'),

  // T-04 is still open (no real SMS provider / sender ID yet). Until then,
  // OTPs can be delivered over WhatsApp via a self-hosted Evolution API
  // instance so real phones actually receive a code. 'fake' keeps the old
  // behavior (code only logged server-side, nothing sent).
  OTP_DELIVERY_CHANNEL: z.enum(['fake', 'whatsapp']).default('fake'),
  EVOLUTION_API_BASE_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),

  STAFF_MFA_ISSUER: z.string().default('Logix'),

  // AES-256-GCM key (32 bytes, base64) for at-rest encryption of IBANs.
  // No KMS/secrets setup yet (same gap as staff_users.totp_secret_enc).
  IBAN_ENCRYPTION_KEY: z.string().min(1),

  // S2 files: stored directly on this server's disk (no S3 yet), served
  // only through an authenticated/authorized endpoint — never from a
  // public static path. Absolute path, outside any web root.
  FILES_STORAGE_DIR: z.string().default('/home/ubuntu/logix/storage/files'),
  FILES_MAX_SIZE_MB: z.coerce.number().int().positive().default(20),

  APP_VERSION_MIN_IOS: z.string().default('1.0.0'),
  APP_VERSION_MIN_ANDROID: z.string().default('1.0.0'),
});

export type Env = z.infer<typeof envSchema>;

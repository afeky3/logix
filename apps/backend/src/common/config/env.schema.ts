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

  APP_VERSION_MIN_IOS: z.string().default('1.0.0'),
  APP_VERSION_MIN_ANDROID: z.string().default('1.0.0'),
});

export type Env = z.infer<typeof envSchema>;

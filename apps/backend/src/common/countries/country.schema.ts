import { z } from 'zod';

/** An ISO 3166-1 alpha-2 code as the apps send it ("sa" is accepted and stored as "SA"). */
export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'countryCode must be a 2-letter ISO code');

/** A list filter: one country, or "ALL" to switch the automatic filter off. */
export const countryFilterSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => v === 'ALL' || /^[A-Z]{2}$/.test(v), 'country must be a 2-letter ISO code or ALL');

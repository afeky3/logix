import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LEGAL_ITEMS } from './legal.rules';
import type { AcceptanceMeta } from './legal-acceptances.service';

export const termsVersionSchema = z.string().trim().min(1).max(50);
export const itemsSchema = z.array(z.enum(LEGAL_ITEMS)).min(1).max(LEGAL_ITEMS.length);

/** Request facts the server records itself. `req.ip` honours X-Forwarded-For only from the
 * trusted proxy (main.ts trustProxy). */
export function acceptanceMeta(req: FastifyRequest, sessionId?: string): AcceptanceMeta {
  const appVersion = req.headers['x-app-version'];
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    appVersion: typeof appVersion === 'string' && appVersion ? appVersion : null,
    sessionId: sessionId ?? null,
  };
}


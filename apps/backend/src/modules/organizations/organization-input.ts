import { z } from 'zod';
import { countryCodeSchema } from '../../common/countries/country.schema';

export const workspaceKinds = ['CUSTOMER', 'SUPPLIER', 'PROVIDER', 'DRIVER'] as const;

/** provider_activity_type: a wrong value is a 400 here, not a database error. */
export const providerActivities = [
  'FREIGHT_SEA',
  'FREIGHT_AIR',
  'FREIGHT_LAND',
  'EXPRESS',
  'TRANSPORT_CARRIER',
  'TRANSPORT_BROKER',
  'WAREHOUSE',
  'CUSTOMS_BROKER',
  'OTHER',
] as const;

/** An organization with, optionally, its first account (and a provider's activities) in one write. */
export const createOrganizationSchema = z
  .object({
    kind: z.enum(['INDIVIDUAL', 'BUSINESS']),
    displayName: z.string().trim().min(1).max(200),
    countryCode: countryCodeSchema.optional(),
    workspace: z.enum(workspaceKinds).optional(),
    activities: z.array(z.enum(providerActivities)).max(20).optional(),
  })
  .refine((v) => !v.activities?.length || v.workspace, {
    message: 'activities need a workspace',
    path: ['activities'],
  });
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

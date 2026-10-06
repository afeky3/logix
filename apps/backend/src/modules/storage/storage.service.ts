import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AppError } from '../../common/errors/app-error';

export interface StorageDetailsInput {
  kind: 'NEW' | 'EXIT' | 'EXTENSION';
  city?: string;
  cityOther?: string;
  storageKind?: 'DRY' | 'CHILLED' | 'FROZEN';
  pallets?: number;
  entryDate?: string;
  parcelReference?: string;
  requestedDate?: string;
  requirements?: string;
}

export interface StorageRow {
  kind: string;
  city: string | null;
  city_other: string | null;
  storage_kind: string | null;
  pallets: number | null;
  entry_date: Date | null;
  parcel_reference: string | null;
  requested_date: Date | null;
  requirements: string | null;
}

/** Storage requests (client round 1, item 7). */
@Injectable()
export class StorageService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireMembership(orgId: string, userId: string) {
    const membership = await this.prisma.memberships.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError('FORBIDDEN', 'Not a member of this organization');
    }
  }

  private async getStorageRequest(requestId: string, userId: string) {
    const request = await this.prisma.service_requests.findUnique({ where: { id: requestId } });
    if (!request || request.service_type !== 'WAREHOUSING') {
      throw new AppError('NOT_FOUND', 'Storage request not found');
    }
    await this.requireMembership(request.customer_org_id, userId);
    return request;
  }

  async saveDetails(requestId: string, userId: string, input: StorageDetailsInput) {
    const request = await this.getStorageRequest(requestId, userId);
    if (request.status !== 'DRAFT') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only a draft request can be edited');
    }
    await this.prisma.$executeRaw`
      INSERT INTO svc.storage_request_details
        (request_id, kind, city, city_other, storage_kind, pallets, entry_date, parcel_reference, requested_date, requirements, updated_at)
      VALUES (${requestId}::uuid, ${input.kind}, ${input.city ?? null}, ${input.cityOther ?? null},
        ${input.storageKind ?? null}, ${input.pallets ?? null}, ${input.entryDate ?? null}::date,
        ${input.parcelReference ?? null}, ${input.requestedDate ?? null}::date, ${input.requirements ?? null}, now())
      ON CONFLICT (request_id) DO UPDATE SET
        kind = EXCLUDED.kind, city = EXCLUDED.city, city_other = EXCLUDED.city_other,
        storage_kind = EXCLUDED.storage_kind, pallets = EXCLUDED.pallets, entry_date = EXCLUDED.entry_date,
        parcel_reference = EXCLUDED.parcel_reference, requested_date = EXCLUDED.requested_date,
        requirements = EXCLUDED.requirements, updated_at = now()
    `;
    return this.get(requestId, userId);
  }

  async get(requestId: string, userId: string) {
    await this.getStorageRequest(requestId, userId);
    const rows = await this.prisma.$queryRaw<StorageRow[]>`
      SELECT kind, city, city_other, storage_kind, pallets, entry_date, parcel_reference, requested_date, requirements
      FROM svc.storage_request_details WHERE request_id = ${requestId}::uuid
    `;
    return rows[0] ?? null;
  }

  /** A storage request can only go out with what its kind needs. */
  async assertReadyToSubmit(requestId: string) {
    const rows = await this.prisma.$queryRaw<StorageRow[]>`
      SELECT kind, city, city_other, storage_kind, pallets, entry_date, parcel_reference, requested_date, requirements
      FROM svc.storage_request_details WHERE request_id = ${requestId}::uuid
    `;
    const d = rows[0];
    const missing: string[] = [];
    if (!d) {
      missing.push('kind');
    } else {
      if (!d.city) missing.push('city');
      if (d.city === 'OTHER' && !d.city_other) missing.push('cityOther');
      if (d.kind === 'NEW') {
        if (!d.storage_kind) missing.push('storageKind');
        if (!d.pallets) missing.push('pallets');
        if (!d.entry_date) missing.push('entryDate');
      } else {
        if (!d.parcel_reference) missing.push('parcelReference');
        if (!d.requested_date) missing.push(d.kind === 'EXIT' ? 'exitDate' : 'extensionUntil');
      }
    }
    if (missing.length) {
      throw new AppError('VALIDATION_FAILED', `Missing required fields: ${missing.join(', ')}`, {
        details: missing.map((m) => ({ field: m, code: 'required' })),
      });
    }
  }
}

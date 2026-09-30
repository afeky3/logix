import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

/**
 * Human-readable reference numbers — backend/md/03-domain-model.md §10.
 * Backed by a Postgres sequence per prefix+year (core.next_reference_seq),
 * created by the S0 migration. Never generate these in application memory.
 */
export type ReferencePrefix = 'LX' | 'PO' | 'RT' | 'CASE' | 'STL' | 'TRX';

@Injectable()
export class ReferenceGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async next(prefix: ReferencePrefix): Promise<string> {
    const year = new Date().getUTCFullYear().toString().slice(-2);
    const rows = await this.prisma.$queryRaw<{ seq: bigint }[]>`
      SELECT core.next_reference_seq(${prefix}, ${year}) AS seq
    `;
    const seq = rows[0].seq.toString().padStart(4, '0');
    return `${prefix}-${year}${seq}`;
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppError } from '../../common/errors/app-error';
import { isValidSaudiIban } from '../../common/util/iban';

const KEY = 'COMPANY_BANK_ACCOUNT';

/** An empty form field means "not set". */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max).optional(),
  );

/**
 * The account customers pay by bank transfer into. Names come in Arabic (the base fields) and,
 * optionally, English: the app shows the one that matches the user's language.
 */
export const companyBankAccountSchema = z.object({
  bankName: z.string().trim().min(2).max(120),
  bankNameEn: optionalText(120),
  accountHolderName: z.string().trim().min(2).max(160),
  accountHolderNameEn: optionalText(160),
  accountNumber: z.preprocess(
    (v) => (typeof v === 'string' ? v.replace(/\s+/g, '') || undefined : v),
    z.string().regex(/^[0-9]{5,30}$/, 'The account number is digits only').optional(),
  ),
  iban: z
    .string()
    .transform((v) => v.replace(/\s+/g, '').toUpperCase())
    .refine(isValidSaudiIban, 'Not a valid Saudi IBAN'),
  note: optionalText(500),
  /** Why it changes: this decides where customers' money goes, so it is always on record. */
  reason: z.string().trim().min(3).max(500),
});
export type CompanyBankAccountInput = z.infer<typeof companyBankAccountSchema>;

interface Stored {
  bankName?: string;
  bankNameEn?: string;
  accountHolderName?: string;
  accountHolderNameEn?: string;
  accountNumber?: string;
  iban?: string;
  note?: string;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** The company bank account kept in sys.app_config: staff edit it, customers' apps read it. */
@Injectable()
export class CompanyBankAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** What staff see: the stored value, whether it is still the seeded placeholder, and who changed it last. */
  async get() {
    const row = await this.prisma.app_config.findUnique({
      where: { key: KEY },
      include: { staff_users: { select: { full_name: true } } },
    });
    const value = (row?.value ?? {}) as Stored;
    return {
      ...value,
      // A placeholder has no valid IBAN: it must never be shown to a customer.
      isPlaceholder: !value.iban || !isValidSaudiIban(value.iban),
      updatedAt: row?.updated_at ?? null,
      updatedByName: row?.staff_users?.full_name ?? null,
    };
  }

  /** What a customer is shown to pay by transfer; 404 until a real account is set. */
  async forCustomers() {
    const row = await this.prisma.app_config.findUnique({ where: { key: KEY } });
    const v = (row?.value ?? {}) as Stored;
    if (!v.iban || !isValidSaudiIban(v.iban) || !v.bankName || !v.accountHolderName) {
      throw new AppError('NOT_FOUND', 'Bank transfer details are not set up yet');
    }
    return {
      bankName: v.bankName,
      bankNameEn: v.bankNameEn ?? null,
      accountHolderName: v.accountHolderName,
      accountHolderNameEn: v.accountHolderNameEn ?? null,
      accountNumber: v.accountNumber ?? null,
      iban: v.iban,
    };
  }

  async put(staffId: string, input: CompanyBankAccountInput, meta: RequestMeta) {
    const { reason, ...fields } = input;
    const value: Stored = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) (value as Record<string, string>)[k] = v as string;

    await this.prisma.$transaction(async (tx) => {
      const before = await tx.app_config.findUnique({ where: { key: KEY } });
      await tx.app_config.upsert({
        where: { key: KEY },
        create: {
          key: KEY,
          value: value as Prisma.InputJsonObject,
          description: 'Company bank account that customer payments are transferred into.',
          updated_by_staff_id: staffId,
        },
        update: { value: value as Prisma.InputJsonObject, updated_by_staff_id: staffId },
      });
      await this.audit.logStaff(
        {
          staffId,
          action: 'company_bank_account.updated',
          entityType: 'APP_CONFIG',
          entityReference: KEY,
          before: (before?.value ?? null) as Prisma.InputJsonValue,
          after: value as Prisma.InputJsonObject,
          reason,
          ip: meta.ip,
          userAgent: meta.userAgent,
          requestId: meta.requestId,
        },
        tx,
      );
    });
    return this.get();
  }
}

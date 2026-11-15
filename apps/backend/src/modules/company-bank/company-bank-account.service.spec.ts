import { CompanyBankAccountService, companyBankAccountSchema } from './company-bank-account.service';

const GOOD = {
  bankName: 'البنك الأهلي السعودي',
  bankNameEn: 'The Saudi National Bank (SNB)',
  accountHolderName: 'مؤسسة خطوة الإنجاز للتخليص الجمركي',
  accountHolderNameEn: 'Est Khatwa Al-Ingaz for Customs',
  accountNumber: '00200001423501',
  iban: 'SA3410000000200001423501',
  reason: 'The account moved to the new branch',
};

describe('company bank account input', () => {
  it('accepts a complete, valid account', () => {
    expect(companyBankAccountSchema.safeParse(GOOD).success).toBe(true);
  });

  it('normalizes the IBAN: spaces out, upper case', () => {
    const r = companyBankAccountSchema.safeParse({ ...GOOD, iban: 'sa34 1000 0000 2000 0142 3501' });
    expect(r.success && r.data.iban).toBe('SA3410000000200001423501');
  });

  it.each(['SA3410000000200001423502', 'SA34100000002000014235', 'GB82WEST12345698765432', 'SA0000000000000000000000', ''])(
    'refuses the IBAN %p',
    (iban) => {
      const r = companyBankAccountSchema.safeParse({ ...GOOD, iban });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].path).toEqual(['iban']);
    },
  );

  it('English names, account number and note are optional, and an empty field means not set', () => {
    const r = companyBankAccountSchema.safeParse({ ...GOOD, bankNameEn: '', accountHolderNameEn: '  ', accountNumber: '', note: '' });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({ bankNameEn: undefined, accountHolderNameEn: undefined, accountNumber: undefined, note: undefined });
  });

  it('the account number is digits only', () => {
    expect(companyBankAccountSchema.safeParse({ ...GOOD, accountNumber: '12ab45' }).success).toBe(false);
    const spaced = companyBankAccountSchema.safeParse({ ...GOOD, accountNumber: '0020 0001 4235 01' });
    expect(spaced.success && spaced.data.accountNumber).toBe('00200001423501');
  });

  it('a change always comes with a reason', () => {
    const { reason: _omitted, ...rest } = GOOD;
    void _omitted;
    expect(companyBankAccountSchema.safeParse(rest).success).toBe(false);
    expect(companyBankAccountSchema.safeParse({ ...GOOD, reason: 'ab' }).success).toBe(false);
  });

  it('bank and holder names are required', () => {
    expect(companyBankAccountSchema.safeParse({ ...GOOD, bankName: '' }).success).toBe(false);
    expect(companyBankAccountSchema.safeParse({ ...GOOD, accountHolderName: ' ' }).success).toBe(false);
  });
});

function setup(stored: Record<string, unknown> | null) {
  const writes: Record<string, unknown>[] = [];
  const audit: Record<string, unknown>[] = [];
  let row = stored ? { key: 'COMPANY_BANK_ACCOUNT', value: stored, updated_at: new Date('2026-11-01T10:00:00Z'), staff_users: { full_name: 'Sara' } } : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the fake refers to itself in $transaction
  const prisma: Record<string, any> = {
    app_config: {
      findUnique: jest.fn(async () => row),
      upsert: jest.fn(async ({ update }: { update: { value: Record<string, unknown> } }) => {
        writes.push(update.value);
        row = { key: 'COMPANY_BANK_ACCOUNT', value: update.value, updated_at: new Date('2026-11-15T10:00:00Z'), staff_users: { full_name: 'Omar' } };
      }),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prisma)),
  };
  const auditService = { logStaff: jest.fn(async (e: Record<string, unknown>) => void audit.push(e)) };
  return { service: new CompanyBankAccountService(prisma as never, auditService as never), prisma, auditService, writes, audit };
}

const PLACEHOLDER = { bankName: 'Placeholder Bank', accountHolderName: 'Logix Trading Co.', iban: 'SA0000000000000000000000', note: 'PLACEHOLDER' };
const REAL = { bankName: 'بنك', bankNameEn: 'Bank', accountHolderName: 'شركة', accountNumber: '123456', iban: 'SA3410000000200001423501' };

describe('CompanyBankAccountService', () => {
  it('staff see the value, who changed it and when, and that it is real', async () => {
    const t = setup(REAL);
    expect(await t.service.get()).toMatchObject({ ...REAL, isPlaceholder: false, updatedByName: 'Sara', updatedAt: new Date('2026-11-01T10:00:00Z') });
  });

  it('flags the seeded placeholder (and a missing row) as a placeholder', async () => {
    expect((await setup(PLACEHOLDER).service.get()).isPlaceholder).toBe(true);
    expect((await setup(null).service.get()).isPlaceholder).toBe(true);
  });

  it('customers get the account with both languages', async () => {
    expect(await setup(REAL).service.forCustomers()).toEqual({
      bankName: 'بنك',
      bankNameEn: 'Bank',
      accountHolderName: 'شركة',
      accountHolderNameEn: null,
      accountNumber: '123456',
      iban: 'SA3410000000200001423501',
    });
  });

  it.each([['the placeholder', PLACEHOLDER], ['nothing at all', null], ['a value without holder', { ...REAL, accountHolderName: undefined }]])(
    'customers never get %s: 404',
    async (_label, stored) => {
      await expect(setup(stored as never).service.forCustomers()).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    },
  );

  it('saving stores the fields without the reason, and records before, after and why in the same transaction', async () => {
    const t = setup(PLACEHOLDER);
    const input = companyBankAccountSchema.parse({ ...GOOD, note: '' });
    const res = await t.service.put('staff-1', input, { ip: '10.0.0.1', userAgent: 'jest', requestId: 'r1' });

    expect(t.writes[0]).toEqual({
      bankName: GOOD.bankName,
      bankNameEn: GOOD.bankNameEn,
      accountHolderName: GOOD.accountHolderName,
      accountHolderNameEn: GOOD.accountHolderNameEn,
      accountNumber: GOOD.accountNumber,
      iban: GOOD.iban,
    });
    expect(t.writes[0]).not.toHaveProperty('reason');
    expect(t.auditService.logStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: 'staff-1',
        action: 'company_bank_account.updated',
        entityReference: 'COMPANY_BANK_ACCOUNT',
        reason: GOOD.reason,
        before: PLACEHOLDER,
        after: t.writes[0],
        ip: '10.0.0.1',
      }),
      t.prisma,
    );
    expect(t.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ iban: GOOD.iban, isPlaceholder: false, updatedByName: 'Omar' });
  });

  it('nothing is audited when the write fails', async () => {
    const t = setup(REAL);
    t.prisma.app_config.upsert.mockRejectedValueOnce(new Error('db down'));
    await expect(t.service.put('staff-1', companyBankAccountSchema.parse(GOOD), {})).rejects.toThrow('db down');
    expect(t.auditService.logStaff).not.toHaveBeenCalled();
  });
});

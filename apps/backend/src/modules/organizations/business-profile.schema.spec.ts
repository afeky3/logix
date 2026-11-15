import { businessProfileSchema } from './kyb.controller';

const base = { legalName: 'Acme Co', crNumber: '1010123456' };

describe('business profile input', () => {
  it('accepts a 10-digit CR and no VAT number', () => {
    expect(businessProfileSchema.safeParse(base).success).toBe(true);
  });

  it.each(['123456789', '12345678901', '10101abcde', ' ', ''])('refuses the CR number %p with a field error', (cr) => {
    const r = businessProfileSchema.safeParse({ ...base, crNumber: cr });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['crNumber']);
  });

  it('trims spaces around the CR number', () => {
    const r = businessProfileSchema.safeParse({ ...base, crNumber: ' 1010123456 ' });
    expect(r.success && r.data.crNumber).toBe('1010123456');
  });

  it('accepts a valid VAT number (15 digits, 3...3) and treats an empty one as absent', () => {
    expect(businessProfileSchema.safeParse({ ...base, vatNumber: '300000000000003' }).success).toBe(true);
    const empty = businessProfileSchema.safeParse({ ...base, vatNumber: '' });
    expect(empty.success && empty.data.vatNumber).toBeUndefined();
  });

  it.each(['400000000000003', '30000000000003', '300000000000004', '3000000000000030'])('refuses the VAT number %p', (vat) => {
    const r = businessProfileSchema.safeParse({ ...base, vatNumber: vat });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['vatNumber']);
  });
});

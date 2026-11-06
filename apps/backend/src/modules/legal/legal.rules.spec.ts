import { AppError } from '../../common/errors/app-error';
import { assertItems, type AcceptanceShape } from './legal.rules';

const P = 'PLATFORM_TERMS_INTERMEDIARY' as const;
const N = 'NO_LIABILITY_GOODS_DISPUTES' as const;
const V = 'VENDOR_RETURN_POLICY' as const;
const E = 'ESCROW_PAYMENT_TERMS' as const;
const ID = '33333333-3333-3333-3333-333333333333';

function fails(a: AcceptanceShape): AppError {
  try {
    assertItems(a);
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected a validation error');
}

describe('legal acceptance items per context', () => {
  it.each(['REGISTRATION', 'APP_LAUNCH'] as const)('%s needs the two platform items', (context) => {
    expect(() => assertItems({ context, items: [P, N] })).not.toThrow();
    const err = fails({ context, items: [P] });
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.httpStatus).toBe(422);
    expect(err.details).toEqual([{ field: 'items', code: 'missing_NO_LIABILITY_GOODS_DISPUTES' }]);
  });

  it('a platform context cannot carry an order subject', () => {
    expect(fails({ context: 'APP_LAUNCH', items: [P, N], quoteId: ID }).httpStatus).toBe(422);
  });

  it('ORDER for a product needs the return-policy item and the supplier', () => {
    expect(() => assertItems({ context: 'ORDER', items: [P, N, V], productId: ID, supplierOrgId: ID })).not.toThrow();
    expect(fails({ context: 'ORDER', items: [P, N], productId: ID, supplierOrgId: ID }).details).toEqual([
      { field: 'items', code: 'missing_VENDOR_RETURN_POLICY' },
    ]);
    expect(fails({ context: 'ORDER', items: [P, N, V], productId: ID }).details).toEqual([
      { field: 'supplierOrgId', code: 'required' },
    ]);
  });

  it('ORDER for a quote needs the escrow item, and the return-policy item is not enough', () => {
    expect(() => assertItems({ context: 'ORDER', items: [P, N, E], quoteId: ID })).not.toThrow();
    const err = fails({ context: 'ORDER', items: [P, V], quoteId: ID });
    expect(err.details?.map((d) => d.code)).toEqual(['missing_NO_LIABILITY_GOODS_DISPUTES', 'missing_ESCROW_PAYMENT_TERMS']);
  });

  it('ORDER names exactly one of quote or product', () => {
    expect(fails({ context: 'ORDER', items: [P, N, E, V] }).httpStatus).toBe(422);
    expect(fails({ context: 'ORDER', items: [P, N, E, V], quoteId: ID, productId: ID, supplierOrgId: ID }).httpStatus).toBe(422);
  });
});

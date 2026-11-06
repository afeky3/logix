import { AppError } from '../../common/errors/app-error';

export const LEGAL_ITEMS = [
  'PLATFORM_TERMS_INTERMEDIARY',
  'NO_LIABILITY_GOODS_DISPUTES',
  'VENDOR_RETURN_POLICY',
  'ESCROW_PAYMENT_TERMS',
] as const;
export type LegalItem = (typeof LEGAL_ITEMS)[number];

export const LEGAL_CONTEXTS = ['REGISTRATION', 'APP_LAUNCH', 'ORDER'] as const;
export type LegalContext = (typeof LEGAL_CONTEXTS)[number];

const PLATFORM: LegalItem[] = ['PLATFORM_TERMS_INTERMEDIARY', 'NO_LIABILITY_GOODS_DISPUTES'];

/** Items a quote acceptance needs on record (used again by POST /quotes/:id/accept). */
export const QUOTE_ORDER_ITEMS: LegalItem[] = [...PLATFORM, 'ESCROW_PAYMENT_TERMS'];
export const PRODUCT_ORDER_ITEMS: LegalItem[] = [...PLATFORM, 'VENDOR_RETURN_POLICY'];

export interface AcceptanceShape {
  context: LegalContext;
  items: LegalItem[];
  quoteId?: string;
  productId?: string;
  supplierOrgId?: string;
}

/** 422 VALIDATION_FAILED, as the app contract asks (the code is usually 400). */
export function legalValidation(message: string, details: { field: string; code: string }[]): AppError {
  return new AppError('VALIDATION_FAILED', message, { details, httpStatus: 422 });
}

/** The items this acceptance must contain, after checking the context/subject combination. */
export function requiredItems(a: AcceptanceShape): LegalItem[] {
  if (a.context !== 'ORDER') {
    if (a.quoteId || a.productId) {
      throw legalValidation('quoteId and productId belong to an ORDER acceptance', [
        { field: a.quoteId ? 'quoteId' : 'productId', code: 'not_allowed' },
      ]);
    }
    return PLATFORM;
  }
  if (Boolean(a.quoteId) === Boolean(a.productId)) {
    throw legalValidation('An ORDER acceptance names exactly one of quoteId or productId', [
      { field: 'quoteId', code: 'quote_or_product_required' },
    ]);
  }
  if (a.productId) {
    if (!a.supplierOrgId) {
      throw legalValidation('supplierOrgId is required for a product order', [
        { field: 'supplierOrgId', code: 'required' },
      ]);
    }
    return PRODUCT_ORDER_ITEMS;
  }
  return QUOTE_ORDER_ITEMS;
}

/** Throws 422 listing every missing item. Extra (known) items are allowed. */
export function assertItems(a: AcceptanceShape): void {
  const missing = requiredItems(a).filter((i) => !a.items.includes(i));
  if (missing.length) {
    throw legalValidation(
      `Missing required items: ${missing.join(', ')}`,
      missing.map((i) => ({ field: 'items', code: `missing_${i}` })),
    );
  }
}

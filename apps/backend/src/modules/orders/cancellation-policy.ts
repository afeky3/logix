export type CancellationTier =
  | 'BEFORE_ACCEPTANCE'
  | 'AFTER_ACCEPTANCE'
  | 'CARRIER_ARRIVED'
  | 'TRANSPORT_STARTED';

/** Customer cancellation fee, as a share of the logistics service value. */
export const TIER_FEE_BPS: Record<CancellationTier, number> = {
  BEFORE_ACCEPTANCE: 0,
  AFTER_ACCEPTANCE: 1000,
  CARRIER_ARRIVED: 2500,
  TRANSPORT_STARTED: 10000,
};

const CANCELLABLE = ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'ACTIVE'];

const STARTED: Record<string, string[]> = {
  TRANSPORT: ['CARGO_COLLECTED', 'DEPARTED', 'ARRIVED_AT_DROPOFF'],
  SHIPPING: ['SHIPPED', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'],
  WAREHOUSING: ['STORED', 'READY_FOR_RELEASE', 'RELEASED'],
  CUSTOMS: [],
};

const ARRIVED: Record<string, string[]> = {
  TRANSPORT: ['ARRIVED_AT_PICKUP'],
  SHIPPING: ['PREPARING'],
  WAREHOUSING: ['RECEIVED'],
  CUSTOMS: ['CLEARANCE_STARTED', 'DECLARATION_SUBMITTED', 'RELEASED'],
};

/**
 * Fee tiers from the platform's terms: free before the provider accepts,
 * 10% once accepted but before the carrier reaches the loading site, 25%
 * once the carrier arrived / customs work began, 100% once the cargo moved.
 * `done` holds the raw trip-event types (transport) or milestone codes.
 * Returns null when the order can no longer be cancelled.
 */
export function cancellationTier(
  status: string,
  serviceType: string,
  done: ReadonlySet<string>,
): CancellationTier | null {
  if (!CANCELLABLE.includes(status)) return null;
  if (status === 'CONFIRMED') return 'BEFORE_ACCEPTANCE';
  if ((STARTED[serviceType] ?? []).some((c) => done.has(c))) return 'TRANSPORT_STARTED';
  if ((ARRIVED[serviceType] ?? []).some((c) => done.has(c))) return 'CARRIER_ARRIVED';
  return 'AFTER_ACCEPTANCE';
}

export function cancellationQuote(
  tier: CancellationTier,
  serviceValueHalalas: number,
  totalHalalas: number,
) {
  const feeBps = TIER_FEE_BPS[tier];
  const fee = Math.min(totalHalalas, Math.round((serviceValueHalalas * feeBps) / 10000));
  return { tier, feeBps, feeHalalas: fee, refundHalalas: totalHalalas - fee };
}

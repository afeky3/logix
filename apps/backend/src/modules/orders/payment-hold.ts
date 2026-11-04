const DEFAULT_BANK_TRANSFER_HOLD_HOURS = 72;

/** How long a bank-transfer intent waits for staff to verify it before payment-expiry.service.ts
 * lets it lapse. Reads the env directly (validated in env.schema.ts) because ContractsService is
 * also built in the worker module, which has no ConfigService. */
export function bankTransferHoldMs(): number {
  const hours = Number(process.env.BANK_TRANSFER_HOLD_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_BANK_TRANSFER_HOLD_HOURS) * 3_600_000;
}

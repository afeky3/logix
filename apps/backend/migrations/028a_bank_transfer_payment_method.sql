-- 028a: bank transfer as a payment method. Manual transfers are confirmed by staff
-- from the dashboard (Payments page), so there is no gateway behind them.
-- Own file, no BEGIN: a new enum value can't be used in the transaction that adds it (same as 024/025).
-- Idempotent.

ALTER TYPE core.payment_method ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

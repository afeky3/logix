-- Client round 1 (item 9): commission is 20% on customs clearance only;
-- every other service stays at the 10% FREIGHT_TRANSPORT rule (rate_bps 1000).
-- Customs quotes read the CUSTOMS_STORAGE rule (see quotes.service.ts,
-- categoryFor). Idempotent: inserts only when no open rule exists.
BEGIN;
INSERT INTO fin.commission_rules (id, category, rate_bps, vat_on_commission, base_definition, effective_from, justification)
SELECT gen_random_uuid(), 'CUSTOMS_STORAGE', 2000, true, 'service_fee (pre-VAT)', now(),
       'Client round 1: 20% on customs clearance'
WHERE NOT EXISTS (
  SELECT 1 FROM fin.commission_rules WHERE category = 'CUSTOMS_STORAGE' AND effective_to IS NULL
);
COMMIT;

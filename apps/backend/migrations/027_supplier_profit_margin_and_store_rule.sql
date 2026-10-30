-- Client round 2:
--  * item 4: a supplier sets a profit margin (basis points) on its organization;
--    each product keeps its base price and the margin applied when it was last
--    created / re-priced. products.unit_price stays the FINAL price buyers see:
--    unit_price = base + base * margin (half-up). Changing the margin does not
--    touch existing products until their price is updated.
--  * item 5: store (marketplace) commission rule, 3.5% of the invoice.
-- Idempotent.
BEGIN;

ALTER TABLE org.organizations
  ADD COLUMN IF NOT EXISTS supplier_profit_margin_bps integer NOT NULL DEFAULT 0
    CHECK (supplier_profit_margin_bps BETWEEN 0 AND 10000);

ALTER TABLE mkt.products
  ADD COLUMN IF NOT EXISTS base_unit_price   bigint,
  ADD COLUMN IF NOT EXISTS profit_margin_bps integer NOT NULL DEFAULT 0
    CHECK (profit_margin_bps BETWEEN 0 AND 10000);

UPDATE mkt.products SET base_unit_price = unit_price::bigint WHERE base_unit_price IS NULL;

INSERT INTO fin.commission_rules (id, category, rate_bps, vat_on_commission, base_definition, effective_from, justification)
SELECT gen_random_uuid(), 'MARKETPLACE', 350, true, 'invoice (pre-VAT)', now(),
       'Client round 2: 3.5% on store (marketplace) invoices'
WHERE NOT EXISTS (
  SELECT 1 FROM fin.commission_rules WHERE category = 'MARKETPLACE' AND effective_to IS NULL
);

COMMIT;

-- Client round 1 (item 5): internal (domestic) transport can be a long-term
-- contract, billed monthly, quarterly, semi-annually or annually (or "other").
BEGIN;
ALTER TABLE svc.transport_request_details
  ADD COLUMN IF NOT EXISTS long_term_contract boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contract_term text
    CHECK (contract_term IN ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'OTHER')),
  ADD COLUMN IF NOT EXISTS contract_term_other text;
COMMIT;

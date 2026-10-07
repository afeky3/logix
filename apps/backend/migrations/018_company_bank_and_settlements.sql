-- Client round 1 (item 14): a placeholder company bank account (payments
-- collect here) and nothing structural for settlements — the table already
-- exists. Replace the placeholder with the real account before go-live.
BEGIN;
INSERT INTO sys.app_config (key, value, description)
VALUES (
  'COMPANY_BANK_ACCOUNT',
  '{"bankName": "Placeholder Bank", "accountHolderName": "Logix Trading Co.", "iban": "SA0000000000000000000000", "note": "PLACEHOLDER — replace with the real company account before go-live"}'::jsonb,
  'Company bank account that customer payments collect into (client round 1, item 14). Placeholder — must be replaced with the real account.'
)
ON CONFLICT (key) DO NOTHING;
COMMIT;

-- The account customers pay by bank transfer is now edited in the dashboard and read by the app
-- (GET /payments/bank-transfer-details). It used to be typed into the app's code.
--  * staff permissions: finance.bank_account.read / .write for SUPER_ADMIN and FINANCE
--  * the stored value gets the account the app has been showing, but only while the seeded
--    placeholder (migration 018) is still in place: an account someone already set is left alone.
-- Idempotent.
BEGIN;

INSERT INTO identity.staff_role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM identity.staff_roles r
CROSS JOIN (VALUES ('finance.bank_account.read'), ('finance.bank_account.write')) AS p(permission)
WHERE r.code IN ('SUPER_ADMIN', 'FINANCE')
ON CONFLICT (role_id, permission) DO NOTHING;

UPDATE sys.app_config
SET value = jsonb_build_object(
      'bankName', 'البنك الأهلي السعودي',
      'bankNameEn', 'The Saudi National Bank (SNB)',
      'accountHolderName', 'مؤسسة خطوة الإنجاز للتخليص الجمركي',
      'accountHolderNameEn', 'Est Khatwa Al-Ingaz for Customs',
      'accountNumber', '00200001423501',
      'iban', 'SA3410000000200001423501'),
    description = 'Company bank account that customer payments are transferred into. Edited in the dashboard (Finance).'
WHERE key = 'COMPANY_BANK_ACCOUNT'
  AND value ->> 'iban' = 'SA0000000000000000000000';

COMMIT;

-- 028b: staff permissions for verifying bank transfers (needs 028a committed first).
--  * seeds the built-in SUPER_ADMIN and FINANCE roles if they don't exist yet
--  * grants both roles finance.payments.read / finance.payments.verify
--  * index for the Payments page (list by status, newest first)
-- Giving a person the SUPER_ADMIN role is a separate step: scripts/grant-staff-role.ts <email>.
-- Idempotent.
BEGIN;

INSERT INTO identity.staff_roles (id, code, name_ar, name_en, is_builtin)
VALUES
  (gen_random_uuid(), 'SUPER_ADMIN', 'مدير النظام', 'Super admin', true),
  (gen_random_uuid(), 'FINANCE', 'المالية', 'Finance', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.staff_role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM identity.staff_roles r
CROSS JOIN (VALUES ('finance.payments.read'), ('finance.payments.verify')) AS p(permission)
WHERE r.code IN ('SUPER_ADMIN', 'FINANCE')
ON CONFLICT (role_id, permission) DO NOTHING;

CREATE INDEX IF NOT EXISTS ix_payment_intents_status_created
  ON fin.payment_intents (status, created_at DESC);

COMMIT;

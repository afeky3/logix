-- 030: columns the code (prisma/schema.prisma) relies on that were added to the server by hand and never
-- recorded in a migration. A database built from migrations alone was missing them, and the first
-- OTP verify failed with "column users.avatar_file_id does not exist". Definitions copied from the
-- server (2026-11-06): nullable, no foreign keys, order_status defaults to 'NEW'.
-- Idempotent: a no-op where they already exist.
BEGIN;

ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS avatar_file_id uuid;
ALTER TABLE org.organizations ADD COLUMN IF NOT EXISTS logo_file_id uuid;
ALTER TABLE msg.conversations ADD COLUMN IF NOT EXISTS order_status varchar(50) DEFAULT 'NEW';

COMMIT;

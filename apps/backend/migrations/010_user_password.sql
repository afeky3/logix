-- App password login (alongside OTP). Stored as an argon2 hash. Nullable:
-- existing OTP-only accounts keep working until they set one.
BEGIN;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS password_hash text;
COMMIT;

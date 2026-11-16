-- Account deletion (Google Play / App Store requirement).
--  * OTP purpose ACCOUNT_DELETION (the code that confirms a deletion).
--  * users.deleted_at: when the account was deleted (status DELETED). The phone and e-mail are released at
--    once (so the person can register again) and kept in erasable_* only until the anonymization job clears
--    them, 30 days later: that is the window to answer disputes and legal requests.
-- ALTER TYPE ... ADD VALUE cannot be used in the transaction that adds it, so it comes first on its own.
ALTER TYPE core.otp_purpose ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION';

BEGIN;
ALTER TABLE identity.users
  ADD COLUMN IF NOT EXISTS deleted_at           timestamptz,
  ADD COLUMN IF NOT EXISTS erasable_phone_e164  text,
  ADD COLUMN IF NOT EXISTS erasable_email       citext;
CREATE INDEX IF NOT EXISTS ix_users_pending_anonymization
  ON identity.users (deleted_at) WHERE status = 'DELETED' AND anonymized_at IS NULL;
COMMIT;

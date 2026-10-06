-- KYB: every verification upload (CR, VAT, bank letter, ...) becomes a
-- DOCUMENT item on the org's open verification case right away, so the
-- admin queue sees it without waiting for the final submit.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
-- older Postgres, so this file stays outside BEGIN/COMMIT.
ALTER TYPE core.verification_item_type ADD VALUE IF NOT EXISTS 'DOCUMENT';

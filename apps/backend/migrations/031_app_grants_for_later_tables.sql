-- 031: the app role could not touch org.org_invitations (023 created it without a GRANT, and only
-- svc/mkt/fin/ops/msg/sys had default privileges). Every invite call failed with "permission denied
-- for table org_invitations" (found 2026-11-06 by an end-to-end run; the server had the same gap).
--  * grant what 001 grants on every other app table
--  * extend the default privileges to the other schemas the app writes to, so the next table a
--    migration adds there is usable without remembering a GRANT. audit stays insert-only (001).
-- Run as logix_migrator. Idempotent.
BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON org.org_invitations TO logix_app;

ALTER DEFAULT PRIVILEGES FOR ROLE logix_migrator IN SCHEMA identity, ref, org, files, freight, transport, warehouse, customs, cms
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO logix_app;

COMMIT;

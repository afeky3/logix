-- Client round 1 (item 2): every choice list has an "أخرى" (Other) option
-- with a free-text value. First one: provider activity.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- Postgres, so the enum change stays outside BEGIN/COMMIT.
ALTER TYPE core.provider_activity_type ADD VALUE IF NOT EXISTS 'OTHER';

BEGIN;
ALTER TABLE org.provider_activities ADD COLUMN IF NOT EXISTS other_text text;
COMMIT;

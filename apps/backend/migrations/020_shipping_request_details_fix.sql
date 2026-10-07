-- Client round 1 (item 2, international shipping): wires the app's route,
-- cargo and extras screens onto the real svc.shipping_request_details
-- table from 001_init.sql, instead of the duplicate table 019 tried to add.
--
-- Additions:
--   * China and Turkey, missing from the seeded country list the app needs
--     (002_seed_countries.sql only covers the Arab world).
--   * container_types seed (never seeded) — STANDARD, HIGH_CUBE, REEFER,
--     OTHER, mirroring ref.vehicle_types' OTHER-with-free-text pattern.
--   * origin/destination free-text labels (port, airport or city name),
--     the same role pickup_label/dropoff_label play for transport — the
--     app doesn't pick from the ports/cities tables.
--   * "Other" free-text companions for country and container type.
--   * border_crossing, with no existing reference table for named land
--     crossings, as a small checked list rather than a new table.
BEGIN;

INSERT INTO ref.countries (code, name_ar, name_en, sort_order)
VALUES ('CN', 'الصين', 'China', 18), ('TR', 'تركيا', 'Turkey', 19)
ON CONFLICT (code) DO NOTHING;

INSERT INTO ref.container_types (code, name_ar, name_en, size_ft, is_reefer, sort_order) VALUES
  ('STANDARD', 'قياسي', 'Standard', 20, false, 1),
  ('HIGH_CUBE', 'مرتفع', 'High cube', 40, false, 2),
  ('REEFER', 'مبرد', 'Reefer', 40, true, 3),
  ('OTHER', 'أخرى', 'Other', NULL, false, 4)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE svc.shipping_request_details
  ADD COLUMN IF NOT EXISTS origin_label text,
  ADD COLUMN IF NOT EXISTS destination_label text,
  ADD COLUMN IF NOT EXISTS origin_country_other text,
  ADD COLUMN IF NOT EXISTS destination_country_other text,
  ADD COLUMN IF NOT EXISTS container_type_other text,
  ADD COLUMN IF NOT EXISTS border_crossing text,
  ADD COLUMN IF NOT EXISTS border_crossing_other text;

ALTER TABLE svc.shipping_request_details
  DROP CONSTRAINT IF EXISTS ck_shipping_border_crossing;
ALTER TABLE svc.shipping_request_details
  ADD CONSTRAINT ck_shipping_border_crossing
  CHECK (border_crossing IS NULL OR border_crossing IN ('BATHA', 'HADITHA', 'RAQI', 'OTHER'));

COMMIT;

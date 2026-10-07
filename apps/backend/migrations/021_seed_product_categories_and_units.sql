-- Client round 1 (product catalog): mkt.product_categories and
-- ref.units_of_measure already existed (from 001_init.sql) but were never
-- seeded, so the supplier's "add product" screens had nothing real to save against.
BEGIN;

-- ck_category_root: (parent_id IS NULL) = (depth = 1) — root categories are depth 1.
INSERT INTO mkt.product_categories (id, slug, name_ar, name_en, depth, sort_order) VALUES
  (gen_random_uuid(), 'packaging', 'تعبئة وتغليف', 'Packaging', 1, 1),
  (gen_random_uuid(), 'equipment', 'معدات', 'Equipment', 1, 2),
  (gen_random_uuid(), 'building-materials', 'مواد بناء', 'Building materials', 1, 3),
  (gen_random_uuid(), 'other', 'أخرى', 'Other', 1, 4)
ON CONFLICT (slug) DO NOTHING;

-- kind check: COUNT, WEIGHT, VOLUME, AREA or CONTAINER.
INSERT INTO ref.units_of_measure (code, kind, name_ar, name_en, sort_order) VALUES
  ('PCS', 'COUNT', 'قطعة', 'Piece', 1),
  ('CARTON', 'CONTAINER', 'كرتونة', 'Carton', 2),
  ('PALLET', 'CONTAINER', 'طبلية', 'Pallet', 3),
  ('KG', 'WEIGHT', 'كيلوجرام', 'Kilogram', 4),
  ('TON', 'WEIGHT', 'طن', 'Ton', 5),
  ('M3', 'VOLUME', 'متر مكعب', 'Cubic meter', 6),
  ('OTHER', 'COUNT', 'أخرى', 'Other', 7)
ON CONFLICT (code) DO NOTHING;

COMMIT;

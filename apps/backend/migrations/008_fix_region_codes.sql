-- 007 seeded ref.regions with a made-up SA-01..SA-13 ordering that did NOT
-- match the real ISO 3166-2:SA codes. Nominatim's `address.ISO3166-2-lvl4`
-- returns the authoritative code for any geocoded point (verified live
-- against all 13 Saudi provinces), so matching against it exactly is far
-- more reliable than the original plan (fuzzy-matching free-text region
-- names) — this replaces the wrong codes with the real ones. Note SA-13
-- is not used by ISO 3166-2:SA; Asir is SA-14.
BEGIN;

DELETE FROM ref.regions WHERE country_code = 'SA';

INSERT INTO ref.regions (code, country_code, name_ar, name_en, sort_order) VALUES
('SA-01', 'SA', 'الرياض', 'Riyadh', 1),
('SA-02', 'SA', 'مكة المكرمة', 'Makkah', 2),
('SA-03', 'SA', 'المدينة المنورة', 'Madinah', 3),
('SA-04', 'SA', 'المنطقة الشرقية', 'Eastern Province', 4),
('SA-05', 'SA', 'القصيم', 'Qassim', 5),
('SA-06', 'SA', 'حائل', 'Hail', 6),
('SA-07', 'SA', 'تبوك', 'Tabuk', 7),
('SA-08', 'SA', 'الحدود الشمالية', 'Northern Borders', 8),
('SA-09', 'SA', 'جازان', 'Jazan', 9),
('SA-10', 'SA', 'نجران', 'Najran', 10),
('SA-11', 'SA', 'الباحة', 'Al Bahah', 11),
('SA-12', 'SA', 'الجوف', 'Al Jouf', 12),
('SA-14', 'SA', 'عسير', 'Asir', 13)
ON CONFLICT (code) DO NOTHING;

COMMIT;

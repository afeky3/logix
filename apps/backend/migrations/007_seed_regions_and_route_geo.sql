-- Seeds Saudi Arabia's 13 administrative regions (never seeded — ref.regions
-- was empty, same reference-data gap as 002-006) and adds pickup/dropoff
-- region columns to transport_request_details so real service-area
-- matching has something to match against (previously impossible: requests
-- only carried free-text labels, no region/city reference at all).
BEGIN;

INSERT INTO ref.regions (code, country_code, name_ar, name_en, sort_order) VALUES
('SA-01', 'SA', 'الرياض', 'Riyadh', 1),
('SA-02', 'SA', 'مكة المكرمة', 'Makkah', 2),
('SA-03', 'SA', 'المدينة المنورة', 'Madinah', 3),
('SA-04', 'SA', 'القصيم', 'Qassim', 4),
('SA-05', 'SA', 'المنطقة الشرقية', 'Eastern Province', 5),
('SA-06', 'SA', 'عسير', 'Asir', 6),
('SA-07', 'SA', 'تبوك', 'Tabuk', 7),
('SA-08', 'SA', 'حائل', 'Hail', 8),
('SA-09', 'SA', 'الحدود الشمالية', 'Northern Borders', 9),
('SA-10', 'SA', 'جازان', 'Jazan', 10),
('SA-11', 'SA', 'نجران', 'Najran', 11),
('SA-12', 'SA', 'الباحة', 'Al Bahah', 12),
('SA-13', 'SA', 'الجوف', 'Al Jouf', 13)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE svc.transport_request_details
  ADD COLUMN IF NOT EXISTS pickup_region_code text REFERENCES ref.regions(code),
  ADD COLUMN IF NOT EXISTS dropoff_region_code text REFERENCES ref.regions(code);

COMMIT;

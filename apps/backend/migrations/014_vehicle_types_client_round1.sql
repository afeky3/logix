-- Client round 1 (item 12): vehicle list. "مقطورة" is renamed "سطحة" in the
-- app; new types: قلاب (dump truck), تريلا (trailer), سيارة (car carrier).
-- OTHER stays last and uses the existing vehicle_description field.
BEGIN;
UPDATE ref.vehicle_types SET name_ar = 'سطحة', name_en = 'Flatbed' WHERE code = 'FLATBED_TRAILER';
UPDATE ref.vehicle_types SET name_ar = 'ناقلة سيارات' WHERE code = 'CAR_CARRIER';
INSERT INTO ref.vehicle_types (code, name_ar, name_en, capacity_ton, is_reefer, is_car_carrier, is_light, is_active, sort_order) VALUES
  ('DUMP_TRUCK', 'قلاب', 'Dump truck', NULL, false, false, false, true, 9),
  ('TRAILER', 'تريلا عادية', 'Standard trailer', NULL, false, false, false, true, 10)
ON CONFLICT (code) DO NOTHING;
UPDATE ref.vehicle_types SET sort_order = 11 WHERE code = 'OTHER';
COMMIT;

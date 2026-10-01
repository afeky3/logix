-- Minimal reference data for S3 (transport requests) — same ref-data gap
-- as 002/003/004. vehicle_types drives the TR01 "scope & vehicle" step;
-- commodity_categories/units_of_measure stay optional on the request so
-- they're not blocking (transport_request_details leaves them nullable).
BEGIN;

INSERT INTO ref.vehicle_types (code, name_ar, name_en, capacity_ton, is_reefer, is_car_carrier, is_light, is_active, sort_order) VALUES
('PICKUP', 'بيك أب', 'Pickup truck', 1.5, false, false, true, true, 1),
('FLATBED_3T', 'دينا 3 طن', 'Flatbed 3T', 3, false, false, true, true, 2),
('FLATBED_7T', 'دينا 7 طن', 'Flatbed 7T', 7, false, false, false, true, 3),
('BOX_TRUCK', 'شاحنة صندوق مغلق', 'Box truck', 10, false, false, false, true, 4),
('REFRIGERATED', 'ثلاجة', 'Refrigerated truck', 10, true, false, false, true, 5),
('FLATBED_TRAILER', 'تريلا سطحة', 'Flatbed trailer', 24, false, false, false, true, 6),
('CAR_CARRIER', 'ناقلة سيارات', 'Car carrier', 0, false, true, false, true, 7),
('OTHER', 'أخرى', 'Other', NULL, false, false, false, true, 8)
ON CONFLICT (code) DO NOTHING;

-- D-02 default: 10% commission on transport/freight, VAT-on-commission on.
INSERT INTO fin.commission_rules (id, category, rate_bps, vat_on_commission, vat_rate_bps, base_definition, effective_from, justification)
SELECT gen_random_uuid(), 'FREIGHT_TRANSPORT', 1000, true, 1500, 'service_fee (pre-VAT)', now(),
       'Default per backend/md/modules/02-organizations-kyb-terms.md onboarding flows: 10% freight/transport commission'
WHERE NOT EXISTS (
  SELECT 1 FROM fin.commission_rules WHERE category = 'FREIGHT_TRANSPORT' AND effective_to IS NULL
);

COMMIT;

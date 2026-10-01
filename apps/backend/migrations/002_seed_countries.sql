-- Minimal reference data: ref.countries had zero rows, so any FK into it
-- (addresses.country_code, etc.) failed — discovered live while testing S2
-- KYB endpoints (addresses_country_code_fkey). Full reference-data seeding
-- (cities, ports, vehicle types, ...) is still an open S0 gap
-- (backend/md/12-execution-plan.md S0 "Reference data") — this is just
-- enough to unblock addresses: Saudi + the countries the app's phone
-- country picker already supports (logic-app static_value.dart) plus GCC.
BEGIN;

INSERT INTO ref.countries (code, name_ar, name_en, phone_code, is_active, sort_order) VALUES
('SA', 'السعودية', 'Saudi Arabia', '966', true, 1),
('EG', 'مصر', 'Egypt', '20', true, 2),
('AE', 'الإمارات', 'United Arab Emirates', '971', true, 3),
('KW', 'الكويت', 'Kuwait', '965', true, 4),
('QA', 'قطر', 'Qatar', '974', true, 5),
('BH', 'البحرين', 'Bahrain', '973', true, 6),
('OM', 'عمان', 'Oman', '968', true, 7),
('JO', 'الأردن', 'Jordan', '962', true, 8),
('LB', 'لبنان', 'Lebanon', '961', true, 9),
('IQ', 'العراق', 'Iraq', '964', true, 10),
('SY', 'سوريا', 'Syria', '963', true, 11),
('YE', 'اليمن', 'Yemen', '967', true, 12),
('DZ', 'الجزائر', 'Algeria', '213', true, 13),
('MA', 'المغرب', 'Morocco', '212', true, 14),
('TN', 'تونس', 'Tunisia', '216', true, 15),
('LY', 'ليبيا', 'Libya', '218', true, 16),
('SD', 'السودان', 'Sudan', '249', true, 17)
ON CONFLICT (code) DO NOTHING;

COMMIT;

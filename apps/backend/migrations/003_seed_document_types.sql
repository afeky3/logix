-- Same gap as 002 (ref data never seeded): documents.document_type_code and
-- document_requirements.document_type_code both FK into ref.document_types,
-- which had zero rows. Discovered live via licenses fk_licenses_document
-- (licenses.document_id -> files.documents.id, not files.files.id directly
-- — a KYB license upload has to go through the documents/document_versions
-- review entity). Codes here mirror core.license_type 1:1 for now; the
-- full matrix (backend/md/modules/02-organizations-kyb-terms.md "Required
-- documents by activity") still needs proper seeding later.
BEGIN;

INSERT INTO ref.document_types (code, name_ar, name_en, reviewer_scope, has_expiry, max_size_mb, is_active, sort_order) VALUES
('COMMERCIAL_REGISTRATION', 'السجل التجاري', 'Commercial Registration', 'STAFF', true, 10, true, 1),
('TGA_TRANSPORT_LICENSE', 'رخصة النقل (الهيئة العامة للنقل)', 'TGA Transport License', 'STAFF', true, 10, true, 2),
('CUSTOMS_BROKER_LICENSE', 'رخصة الوساطة الجمركية', 'Customs Broker License', 'STAFF', true, 10, true, 3),
('VAT_CERTIFICATE', 'شهادة ضريبة القيمة المضافة', 'VAT Certificate', 'STAFF', true, 10, true, 4),
('NATIONAL_ADDRESS_PROOF', 'إثبات العنوان الوطني', 'National Address Proof', 'STAFF', false, 10, true, 5),
('INSURANCE_POLICY', 'وثيقة التأمين', 'Insurance Policy', 'STAFF', true, 10, true, 6),
('WAREHOUSE_LICENSE', 'رخصة المستودع', 'Warehouse License', 'STAFF', true, 10, true, 7),
('OTHER', 'مستند آخر', 'Other document', 'STAFF', false, 10, true, 8)
ON CONFLICT (code) DO NOTHING;

COMMIT;

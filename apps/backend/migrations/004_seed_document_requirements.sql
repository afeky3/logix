-- Minimal document-requirements matrix (GET /document-requirements drives
-- the A06 checklist) — backend/md/modules/02-organizations-kyb-terms.md
-- "Required documents by activity". Context 'KYB' only for now; other
-- contexts (order documents, etc.) are a later slice.
BEGIN;

INSERT INTO ref.document_requirements (id, context, workspace, activity, document_type_code, requirement, is_active) VALUES
(gen_random_uuid(), 'KYB', 'SUPPLIER', NULL, 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'SUPPLIER', NULL, 'NATIONAL_ADDRESS_PROOF', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'SUPPLIER', NULL, 'VAT_CERTIFICATE', 'AS_APPLICABLE', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_CARRIER', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_CARRIER', 'TGA_TRANSPORT_LICENSE', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_CARRIER', 'INSURANCE_POLICY', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_BROKER', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_BROKER', 'TGA_TRANSPORT_LICENSE', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'TRANSPORT_BROKER', 'INSURANCE_POLICY', 'OPTIONAL', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_SEA', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_SEA', 'INSURANCE_POLICY', 'OPTIONAL', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_AIR', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_AIR', 'INSURANCE_POLICY', 'OPTIONAL', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_LAND', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'FREIGHT_LAND', 'INSURANCE_POLICY', 'OPTIONAL', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'EXPRESS', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'EXPRESS', 'INSURANCE_POLICY', 'OPTIONAL', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'WAREHOUSE', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'WAREHOUSE', 'WAREHOUSE_LICENSE', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'WAREHOUSE', 'INSURANCE_POLICY', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'CUSTOMS_BROKER', 'COMMERCIAL_REGISTRATION', 'REQUIRED', true),
(gen_random_uuid(), 'KYB', 'PROVIDER', 'CUSTOMS_BROKER', 'CUSTOMS_BROKER_LICENSE', 'REQUIRED', true);

COMMIT;

-- 026: customs clearance, client step 3
--   IMPORT / TRANSIT: bill of lading, commercial invoice, packing list,
--                     certificate of origin, SABER certificate, other
--   EXPORT:           booking confirmation, commercial invoice,
--                     certificate of origin, other
-- All of them are optional for now (customs.service.ts,
-- CUSTOMS_DOCS_MANDATORY). ORIGIN_INVOICE stays allowed for rows written
-- under 015 but is no longer offered.
--
-- Free attachments: any number of extra files the broker asks the
-- customer for, before or after the request is submitted.
BEGIN;
ALTER TABLE svc.customs_documents DROP CONSTRAINT IF EXISTS customs_documents_doc_type_check;
ALTER TABLE svc.customs_documents ADD CONSTRAINT customs_documents_doc_type_check CHECK (doc_type IN (
  'BILL_OF_LADING', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CERTIFICATE_OF_ORIGIN',
  'SABER_CERTIFICATE', 'BOOKING_CONFIRMATION', 'OTHER', 'ORIGIN_INVOICE'));

CREATE TABLE IF NOT EXISTS svc.customs_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES svc.service_requests(id) ON DELETE CASCADE,
  file_id     uuid NOT NULL REFERENCES files.files(id),
  note        text CHECK (note IS NULL OR length(note) <= 500),
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_customs_attachments_request ON svc.customs_attachments (request_id, uploaded_at);
COMMIT;

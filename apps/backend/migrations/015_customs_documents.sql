-- Client round 1 (item 3): customs documents per movement.
--   IMPORT: certificate of origin, bill of lading, commercial invoice
--   EXPORT: origin invoice, packing list
-- Files for these are uploaded with purpose SHIPMENT_DOCUMENT.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- Postgres, so the enum change stays outside BEGIN/COMMIT.
ALTER TYPE core.file_purpose ADD VALUE IF NOT EXISTS 'SHIPMENT_DOCUMENT';

BEGIN;
CREATE TABLE IF NOT EXISTS svc.customs_documents (
  request_id  uuid NOT NULL REFERENCES svc.service_requests(id) ON DELETE CASCADE,
  doc_type    text NOT NULL CHECK (doc_type IN (
                'CERTIFICATE_OF_ORIGIN', 'BILL_OF_LADING', 'COMMERCIAL_INVOICE',
                'ORIGIN_INVOICE', 'PACKING_LIST')),
  file_id     uuid NOT NULL REFERENCES files.files(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, doc_type)
);
COMMIT;

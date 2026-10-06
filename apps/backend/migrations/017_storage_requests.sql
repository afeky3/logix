-- Client round 1 (item 7): storage requests. A customer can ask for new
-- storage, for an exit (release a parcel), or for an extension of storage time.
BEGIN;
CREATE TABLE IF NOT EXISTS svc.storage_request_details (
  request_id        uuid PRIMARY KEY REFERENCES svc.service_requests(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('NEW', 'EXIT', 'EXTENSION')),
  city              text,
  city_other        text,
  storage_kind      text CHECK (storage_kind IN ('DRY', 'CHILLED', 'FROZEN')),
  pallets           integer CHECK (pallets IS NULL OR pallets > 0),
  entry_date        date,
  parcel_reference  text,
  requested_date    date,
  requirements      text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
COMMIT;

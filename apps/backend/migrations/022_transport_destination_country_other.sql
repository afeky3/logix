-- Client round 1 (item 5, external transport): cross-border domestic
-- transport uses the same vehicles and pricing as internal — the only
-- addition is a destination country, with a free-text fallback like the
-- other "Other" choices added this round.
BEGIN;
ALTER TABLE svc.transport_request_details
  ADD COLUMN IF NOT EXISTS destination_country_other text;
COMMIT;

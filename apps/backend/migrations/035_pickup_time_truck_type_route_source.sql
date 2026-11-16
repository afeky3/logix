-- Three small additions the app asked for.
--  * transport_request_details.pickup_time: the preferred pickup time of an in-country transport (HH:mm).
--  * transport_request_details.route_source: whether the distance came from a routing service (ROUTED)
--    or is the fixed fallback estimate (ESTIMATED). Rows saved before this column stay NULL: their source
--    was never recorded, so they are reported as ESTIMATED rather than claimed to be real.
--  * shipping_request_details.truck_type: the truck for an international land shipment.
-- Idempotent.
BEGIN;

ALTER TABLE svc.transport_request_details
  ADD COLUMN IF NOT EXISTS pickup_time  time,
  ADD COLUMN IF NOT EXISTS route_source text CHECK (route_source IN ('ROUTED', 'ESTIMATED'));

ALTER TABLE svc.shipping_request_details
  ADD COLUMN IF NOT EXISTS truck_type text CHECK (truck_type IN ('TRAILER', 'REEFER', 'SEMI'));

COMMIT;

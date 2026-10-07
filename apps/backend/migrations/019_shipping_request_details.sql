-- Client round 1 (item 2, international shipping lists): the international
-- flow (route, cargo, extras, review) never wrote to the backend at all.
-- One row per request, filled in gradually across the four steps.
BEGIN;
CREATE TABLE IF NOT EXISTS svc.shipping_request_details (
  request_id          uuid PRIMARY KEY REFERENCES svc.service_requests(id) ON DELETE CASCADE,
  freight_mode         text CHECK (freight_mode IN ('SEA', 'AIR', 'LAND')),
  trade_direction       text CHECK (trade_direction IN ('IMPORT', 'EXPORT')),
  origin_country        text,
  origin_country_other  text,
  destination_country       text,
  destination_country_other text,
  pol_label             text,
  pod_label             text,
  goods_type            text CHECK (goods_type IN ('INDUSTRIAL', 'CONSUMER', 'RAW', 'OTHER')),
  goods_type_other      text,
  container_kind        text CHECK (container_kind IN ('STANDARD', 'HIGH_CUBE', 'REEFER', 'OTHER')),
  container_kind_other  text,
  border_crossing       text CHECK (border_crossing IN ('BATHA', 'HADITHA', 'RAQI', 'OTHER')),
  border_crossing_other text,
  pieces_count          integer,
  weight_kg             numeric(12, 2),
  hs_code               text,
  goods_description     text,
  dimensions_cm         text,
  volume_cbm            numeric(12, 2),
  dangerous_goods       boolean,
  door_to_door          boolean,
  urgent_priority       boolean,
  customs_on_arrival    boolean,
  temporary_storage     boolean,
  readiness_date        date,
  special_requirements  text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
COMMIT;

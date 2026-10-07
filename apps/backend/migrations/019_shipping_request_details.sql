-- Superseded before it ran anywhere useful: svc.shipping_request_details
-- already existed from 001_init.sql with a proper normalized schema
-- (shipping_mode, trade_direction, country/port/city FKs, container_types,
-- commodity_categories, extras jsonb, cargo_ready_date, ...). The
-- CREATE TABLE IF NOT EXISTS below was a no-op against that table — it never
-- altered anything. See 020_shipping_request_details_fix.sql for the real
-- additive changes against the existing table (client round 1, item 2).
SELECT 1;

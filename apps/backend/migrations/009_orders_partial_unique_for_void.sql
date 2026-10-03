-- S4 gap-fill follow-up: payment-expiry.service.ts (008's sibling, added
-- right after) voids an order whose payment never came through and reopens
-- its quote/request so they can be accepted again — but orders.request_id
-- and orders.accepted_quote_id both had a plain UNIQUE constraint, assuming
-- exactly one order ever exists per request/quote. A VOID order still held
-- that slot, so a reopened quote could never actually be re-accepted
-- (confirmed live: accept returned the same dead VOID order every time).
--
-- Replaces both with a partial unique index that excludes VOID orders —
-- at most one *live* order per request/quote, but a VOID one doesn't
-- block a fresh attempt. This is what the VOID status was for.
BEGIN;

ALTER TABLE svc.orders DROP CONSTRAINT orders_accepted_quote_id_key;
ALTER TABLE svc.orders DROP CONSTRAINT orders_request_id_key;

CREATE UNIQUE INDEX orders_accepted_quote_id_live_key
  ON svc.orders (accepted_quote_id) WHERE status <> 'VOID';
CREATE UNIQUE INDEX orders_request_id_live_key
  ON svc.orders (request_id) WHERE status <> 'VOID';

COMMIT;

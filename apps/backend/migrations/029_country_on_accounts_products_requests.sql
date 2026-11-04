-- 029: a country on accounts, products and service requests, so the apps can scope what a user sees
-- to the country of the account they're working in.
--  * org.organizations.country_code  the account's country (an account is an organization / workspace)
--  * mkt.products.country_code       the country the listing is offered in. Not origin_country_code,
--                                    which stays "made in".
--  * svc.service_requests.country_code  the country the service is requested for
-- Everything that exists today is Saudi, so SA is the default and the backfill. Idempotent.
BEGIN;

ALTER TABLE org.organizations
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'SA' REFERENCES ref.countries(code);

ALTER TABLE mkt.products
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'SA' REFERENCES ref.countries(code);

ALTER TABLE svc.service_requests
  ADD COLUMN IF NOT EXISTS country_code char(2) NOT NULL DEFAULT 'SA' REFERENCES ref.countries(code);

CREATE INDEX IF NOT EXISTS ix_organizations_country ON org.organizations (country_code);
CREATE INDEX IF NOT EXISTS ix_products_country_browse ON mkt.products (country_code, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS ix_service_requests_country ON svc.service_requests (country_code, status);

COMMIT;

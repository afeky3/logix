-- Legal acceptances (the user's explicit agreement to the intermediary terms, the no-liability
-- statement, the supplier's return policy and the escrow payment terms) and suppliers' return
-- policies with their full version history.
--
-- A separate table from org.consents on purpose: org.consents is one row per consent key, needs an
-- organization, and is unique per (user, key, context, terms document), so it can neither hold a
-- registration (no organization yet) nor a second acceptance of a newer terms version. It stays
-- exactly as it is for POST /consents. Both new history tables are append-only like org.consents.

BEGIN;

-- ---------------------------------------------------------------- return policies
CREATE TABLE mkt.return_policy_versions (
  id                  uuid PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES org.organizations(id),
  version             integer NOT NULL CHECK (version >= 1),
  text                text NOT NULL CHECK (char_length(btrim(text)) >= 10),
  return_window_days  integer CHECK (return_window_days >= 0),
  allows_return       boolean NOT NULL,
  allows_exchange     boolean NOT NULL,
  created_by_user_id  uuid NOT NULL REFERENCES identity.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_return_policy_version UNIQUE (organization_id, version)
);

-- One row per supplier: which version is in force now.
CREATE TABLE mkt.return_policies (
  organization_id     uuid PRIMARY KEY REFERENCES org.organizations(id),
  current_version_id  uuid NOT NULL REFERENCES mkt.return_policy_versions(id),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- legal acceptances
CREATE TABLE org.legal_acceptances (
  id                        uuid PRIMARY KEY,
  user_id                   uuid NOT NULL REFERENCES identity.users(id),
  organization_id           uuid REFERENCES org.organizations(id),     -- null at registration
  context                   text NOT NULL CHECK (context IN ('REGISTRATION', 'APP_LAUNCH', 'ORDER')),
  items                     text[] NOT NULL CHECK (
                              cardinality(items) > 0 AND items <@ ARRAY[
                                'PLATFORM_TERMS_INTERMEDIARY', 'NO_LIABILITY_GOODS_DISPUTES',
                                'VENDOR_RETURN_POLICY', 'ESCROW_PAYMENT_TERMS']::text[]),
  terms_version             text NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 50),
  locale                    text NOT NULL CHECK (locale IN ('ar', 'en')),
  quote_id                  uuid REFERENCES svc.quotes(id),
  product_id                uuid REFERENCES mkt.products(id),
  supplier_org_id           uuid REFERENCES org.organizations(id),
  return_policy_version_id  uuid REFERENCES mkt.return_policy_versions(id),
  return_policy_version     text,                                      -- as shown to the buyer
  -- Snapshot at the moment of acceptance: the organization's CR today; NATIONAL_ID once the
  -- app collects it for individuals.
  identity_number           text,
  identity_type             text CHECK (identity_type IN ('CR', 'NATIONAL_ID')),
  ip                        text,
  user_agent                text,
  app_version               text,
  accepted_at               timestamptz NOT NULL DEFAULT now(),        -- server clock only
  CONSTRAINT ck_legal_identity CHECK ((identity_number IS NULL) = (identity_type IS NULL)),
  CONSTRAINT ck_legal_order_subject CHECK (
    (context = 'ORDER' AND num_nonnulls(quote_id, product_id) = 1)
    OR (context <> 'ORDER' AND quote_id IS NULL AND product_id IS NULL)),
  CONSTRAINT ck_legal_product_supplier CHECK (product_id IS NULL OR supplier_org_id IS NOT NULL)
);
CREATE INDEX ix_legal_user_context ON org.legal_acceptances (user_id, context, accepted_at DESC);
CREATE INDEX ix_legal_org ON org.legal_acceptances (organization_id, accepted_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX ix_legal_quote ON org.legal_acceptances (quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX ix_legal_product ON org.legal_acceptances (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX ix_legal_accepted ON org.legal_acceptances (accepted_at DESC);

-- ---------------------------------------------------------------- append-only + grants
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON org.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION core.forbid_mutation();
CREATE TRIGGER trg_append_only BEFORE UPDATE OR DELETE ON mkt.return_policy_versions
  FOR EACH ROW EXECUTE FUNCTION core.forbid_mutation();

GRANT SELECT, INSERT ON org.legal_acceptances, mkt.return_policy_versions TO logix_app;
REVOKE UPDATE, DELETE ON org.legal_acceptances, mkt.return_policy_versions FROM logix_app;
GRANT SELECT, INSERT, UPDATE ON mkt.return_policies TO logix_app;

-- Dashboard "Consent log" (SUPER_ADMIN already passes every check; the row documents it).
INSERT INTO identity.staff_role_permissions (role_id, permission)
SELECT r.id, 'legal.acceptances.read' FROM identity.staff_roles r WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT (role_id, permission) DO NOTHING;

COMMIT;

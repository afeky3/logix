-- 023: org member invitations
-- Allows org owners/managers to invite users by phone number.
-- Accepting the invite activates the pre-created membership row (and, for
-- DRIVER role, automatically creates a transport.drivers profile).

CREATE TABLE org.org_invitations (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid         NOT NULL REFERENCES org.organizations(id),
  phone_e164          text         NOT NULL,
  role                org.membership_role NOT NULL DEFAULT 'MEMBER',
  invited_by_user_id  uuid         NOT NULL REFERENCES identity.users(id),
  token               text         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  expires_at          timestamptz  NOT NULL DEFAULT now() + interval '7 days',
  used_at             timestamptz,
  membership_id       uuid         REFERENCES org.memberships(id),
  created_at          timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX ix_org_invitations_phone ON org.org_invitations(phone_e164) WHERE used_at IS NULL;

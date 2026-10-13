-- 024: recurring (long-term) transport contracts
--
-- A transport request marked as a long-term contract (016) is billed per
-- month instead of once: the first month is paid when the offer is accepted,
-- each later month becomes a cycle the customer pays before it starts. An
-- unpaid cycle suspends the contract until it is paid. The provider is
-- settled per paid cycle (fin.settlements.period_no = cycle number).

CREATE TYPE core.contract_status AS ENUM ('ACTIVE', 'SUSPENDED', 'ENDING', 'ENDED');
CREATE TYPE core.contract_cycle_status AS ENUM ('DUE', 'PAID', 'OVERDUE', 'VOID');

CREATE TABLE svc.recurring_contracts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid        NOT NULL UNIQUE REFERENCES svc.orders(id),
  customer_org_id  uuid        NOT NULL REFERENCES org.organizations(id),
  provider_org_id  uuid        NOT NULL REFERENCES org.organizations(id),
  -- NULL = open ended: renews every month until the customer stops it
  term_months      smallint    CHECK (term_months IS NULL OR term_months BETWEEN 1 AND 120),
  cycle_amount     core.halalas NOT NULL,
  start_date       date        NOT NULL,
  status           core.contract_status NOT NULL DEFAULT 'ACTIVE',
  suspended_at     timestamptz,
  end_requested_at timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE svc.contract_cycles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid        NOT NULL REFERENCES svc.recurring_contracts(id),
  cycle_no      smallint    NOT NULL CHECK (cycle_no > 0),
  period_start  date        NOT NULL,
  period_end    date        NOT NULL,
  due_date      date        NOT NULL,
  amount        core.halalas NOT NULL,
  status        core.contract_cycle_status NOT NULL,
  reminder_at   timestamptz,
  paid_at       timestamptz,
  invoice_id    uuid        REFERENCES fin.invoices(id),
  settlement_id uuid        REFERENCES fin.settlements(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, cycle_no),
  CONSTRAINT ck_cycle_period CHECK (period_end > period_start),
  CONSTRAINT ck_cycle_paid CHECK (status <> 'PAID' OR paid_at IS NOT NULL)
);

CREATE INDEX ix_contract_cycles_open ON svc.contract_cycles (due_date) WHERE status IN ('DUE', 'OVERDUE');
CREATE INDEX ix_recurring_contracts_live ON svc.recurring_contracts (status) WHERE status <> 'ENDED';

CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON svc.recurring_contracts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON svc.contract_cycles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();

-- A cycle is paid through the same payment intents as an order.
ALTER TYPE core.payable_type ADD VALUE IF NOT EXISTS 'CONTRACT_CYCLE';

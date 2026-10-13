-- 025: let a payment intent point at a contract cycle (needs 024's enum value committed first)

ALTER TABLE fin.payment_intents ADD COLUMN contract_cycle_id uuid REFERENCES svc.contract_cycles(id);

ALTER TABLE fin.payment_intents DROP CONSTRAINT ck_intent_payable;
ALTER TABLE fin.payment_intents ADD CONSTRAINT ck_intent_payable CHECK (
  (payable_type = 'ORDER' AND order_id IS NOT NULL
     AND num_nonnulls(purchase_order_id, additional_charge_id, insurance_request_id, contract_cycle_id) = 0)
  OR (payable_type = 'PURCHASE_ORDER' AND purchase_order_id IS NOT NULL
     AND num_nonnulls(order_id, additional_charge_id, insurance_request_id, contract_cycle_id) = 0)
  OR (payable_type = 'ADDITIONAL_CHARGE' AND additional_charge_id IS NOT NULL
     AND num_nonnulls(order_id, purchase_order_id, insurance_request_id, contract_cycle_id) = 0)
  OR (payable_type = 'INSURANCE_PREMIUM' AND insurance_request_id IS NOT NULL
     AND num_nonnulls(order_id, purchase_order_id, additional_charge_id, contract_cycle_id) = 0)
  OR (payable_type = 'CONTRACT_CYCLE' AND contract_cycle_id IS NOT NULL
     AND num_nonnulls(order_id, purchase_order_id, additional_charge_id, insurance_request_id) = 0)
);

CREATE INDEX ix_payment_intents_cycle ON fin.payment_intents (contract_cycle_id) WHERE contract_cycle_id IS NOT NULL;

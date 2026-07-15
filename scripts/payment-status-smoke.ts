import assert from "node:assert/strict";
import { evaluatePaymentStatus, buildPaymentHistory } from "../lib/payment-status";

const tenant = {
  id: "1",
  name: "Demo",
  phone: "",
  property_type: "Apartment",
  active: true,
  base_rent: 1000,
};

const payments = [
  {
    tenant_id: "1",
    month: "2026-07",
    paid_on: "2026-07-03",
    notes: "",
  },
  {
    tenant_id: "1",
    month: "2026-06",
    paid_on: "2026-06-12",
    notes: "",
  },
];

const paidStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-07",
});
assert.equal(paidStatus.status, "paid");
assert.equal(paidStatus.isLate, false);

const lateStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-06",
  onTimeDayLimit: 7,
});
assert.equal(lateStatus.status, "late");
assert.equal(lateStatus.isLate, true);

const pendingStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-08",
});
assert.equal(pendingStatus.status, "pending");
assert.equal(pendingStatus.isLate, false);

const normalizedTenant = {
  ...tenant,
  id: " T1 ",
};
const normalizedPayment = {
  tenant_id: "t1",
  month: "2026-06",
  paid_on: "2026-06-10",
  notes: "",
};
const normalizedStatus = evaluatePaymentStatus({
  tenant: normalizedTenant,
  payments: [normalizedPayment],
  rentMonth: "2026-06",
});
assert.equal(normalizedStatus.status, "paid");
assert.equal(normalizedStatus.payment?.tenant_id, "t1");

const history = buildPaymentHistory({
  tenant,
  payments,
  fromMonth: "2026-06",
  toMonth: "2026-08",
});
assert.equal(history.length, 3);
assert.equal(history[0].month, "2026-06");
assert.equal(history[1].month, "2026-07");
assert.equal(history[2].month, "2026-08");

console.log("payment-status smoke test passed");

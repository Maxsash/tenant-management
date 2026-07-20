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
  {
    tenant_id: "1",
    month: "2024-09",
    paid_on: "2024-09-06",
    notes: "",
  },
  {
    tenant_id: "1",
    month: "2024-10",
    paid_on: "2024-10-08",
    notes: "",
  },
];

const paidStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-06",
});
assert.equal(paidStatus.status, "paid");
assert.equal(paidStatus.isLate, false);

const lateStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-05",
  onTimeDayLimit: 7,
});
assert.equal(lateStatus.status, "late");
assert.equal(lateStatus.isLate, true);

const nextMonthOnTimeStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2024-08",
  onTimeDayLimit: 7,
});
assert.equal(nextMonthOnTimeStatus.status, "paid");
assert.equal(nextMonthOnTimeStatus.isLate, false);

const nextMonthLateStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2024-09",
  onTimeDayLimit: 7,
});
assert.equal(nextMonthLateStatus.status, "late");
assert.equal(nextMonthLateStatus.isLate, true);

const pendingStatus = evaluatePaymentStatus({
  tenant,
  payments,
  rentMonth: "2026-07",
});
assert.equal(pendingStatus.status, "pending");
assert.equal(pendingStatus.isLate, false);

const history = buildPaymentHistory({
  tenant,
  payments,
  fromMonth: "2026-05",
  toMonth: "2026-07",
});
assert.equal(history.length, 3);
assert.equal(history[0].month, "2026-05");
assert.equal(history[1].month, "2026-06");
assert.equal(history[2].month, "2026-07");

console.log("payment-status smoke test passed");

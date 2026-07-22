import type { Payment } from "@/types/payment";

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    tenant_id: "tenant-1",
    month: "2026-07",
    paid_on: "2026-07-03",
    ...overrides,
  };
}

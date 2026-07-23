export type PaymentStatus = "paid" | "late" | "pending";

export interface Payment {
  id?: string | number;
  tenant_id: string;
  // `payment_month` is the month the payment occurred (YYYY-MM), derived
  // from the `payments.month` DB column. Prefer `payment_month` in
  // application code; `month` is kept as the raw DB field.
  payment_month?: string;
  // Derived by `getPayments` (lib/db.ts) via `getRentMonth(payment_month)`.
  rent_month?: string;
  month?: string;
  paid_on?: string | null;
  notes?: string;
  method?: string;
  receipt_url?: string;
  status?: PaymentStatus;
}
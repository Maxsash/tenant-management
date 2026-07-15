export type PaymentStatus = "paid" | "late" | "pending";

export interface Payment {
  id?: string;
  tenant_id: string;
  // `payment_month` is the month the payment occurred (YYYY-MM).
  // Keep `month` for compatibility with existing sheet headers, but
  // prefer `payment_month` in application code.
  payment_month?: string;
  month?: string;
  paid_on?: string;
  notes?: string;
  method?: string;
  receipt_url?: string;
  status?: PaymentStatus;
}
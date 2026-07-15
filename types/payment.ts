export type PaymentStatus = "paid" | "late" | "pending";

export interface Payment {
  id?: string;
  tenant_id: string;
  month: string;
  paid_on?: string;
  notes?: string;
  method?: string;
  receipt_url?: string;
  status?: PaymentStatus;
}
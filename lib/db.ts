import { supabase } from "@/lib/supabase";
import { getRentMonth } from "@/lib/rent";

export async function getTenants<T>(): Promise<T[]> {
  const { data, error } = await supabase.from("tenants").select("*");

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }

  return (data ?? []) as T[];
}

export async function getPayments<T>(): Promise<T[]> {
  const { data, error } = await supabase.from("payments").select("*");

  if (error) {
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  // Provide explicit `payment_month` and computed `rent_month` fields
  // alongside the raw `month` column.
  return (data ?? []).map((r: any) => {
    const payment_month = String(r.month ?? "").slice(0, 7);
    const rent_month = payment_month ? getRentMonth(payment_month) : "";

    return {
      ...r,
      payment_month,
      rent_month,
    } as T;
  });
}

export async function insertPayment(payment: {
  tenant_id: string;
  month: string;
  paid_on: string;
}) {
  const { error } = await supabase.from("payments").insert(payment);

  if (error) {
    throw new Error(`Failed to insert payment: ${error.message}`);
  }
}

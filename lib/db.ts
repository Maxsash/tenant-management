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

export async function getExpenses<T>(): Promise<T[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch expenses: ${error.message}`);
  }

  return (data ?? []) as T[];
}

export async function insertExpense(expense: {
  expense_date: string;
  item_id?: string | null;
  item_name: string;
  category: string;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  payment_method: string;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("expenses")
    .insert(expense)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert expense: ${error.message}`);
  }

  return data;
}

export async function updateExpense(
  id: string,
  patch: Partial<{
    expense_date: string;
    item_id: string | null;
    item_name: string;
    category: string;
    quantity: number | null;
    unit: string | null;
    amount: number;
    payment_method: string;
    notes: string | null;
  }>
) {
  const { data, error } = await supabase
    .from("expenses")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update expense: ${error.message}`);
  }

  return data;
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}

export async function getExpenseItems<T>(includeInactive = false): Promise<T[]> {
  let query = supabase.from("expense_items").select("*").order("name");

  if (!includeInactive) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch expense items: ${error.message}`);
  }

  return (data ?? []) as T[];
}

export async function insertExpenseItem(item: {
  name: string;
  category: string;
  default_unit?: string | null;
}) {
  const { data, error } = await supabase
    .from("expense_items")
    .insert(item)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert expense item: ${error.message}`);
  }

  return data;
}

export async function updateExpenseItem(
  id: string,
  patch: Partial<{
    name: string;
    category: string;
    default_unit: string | null;
    active: boolean;
  }>
) {
  const { data, error } = await supabase
    .from("expense_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update expense item: ${error.message}`);
  }

  return data;
}

export async function isExpenseItemInUse(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);

  if (error) {
    throw new Error(`Failed to check expense item usage: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function deleteExpenseItem(id: string) {
  const { error } = await supabase.from("expense_items").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete expense item: ${error.message}`);
  }
}

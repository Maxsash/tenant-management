import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseFrom, mockSupabaseFromOnce } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/lib/supabase";
import {
  deleteExpense,
  deleteExpenseCategory,
  deleteExpenseItem,
  getExpenseCategories,
  getExpenseCategoryById,
  getExpenseItems,
  getExpenses,
  getPayments,
  getTenants,
  insertExpense,
  insertExpenseCategory,
  insertExpenseItem,
  insertPayment,
  isExpenseCategoryInUse,
  isExpenseItemInUse,
  updateExpense,
  updateExpenseCategory,
  updateExpenseItem,
} from "./db";

type Row = Record<string, unknown>;

const fromMock = vi.mocked(supabase.from);

beforeEach(() => {
  fromMock.mockReset();
});

describe("getTenants", () => {
  it("returns tenants on success", async () => {
    mockSupabaseFrom(fromMock, { data: [{ id: "1" }] });
    await expect(getTenants<Row>()).resolves.toEqual([{ id: "1" }]);
  });

  it("returns [] when data is null", async () => {
    mockSupabaseFrom(fromMock, { data: null });
    await expect(getTenants<Row>()).resolves.toEqual([]);
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getTenants<Row>()).rejects.toThrow("Failed to fetch tenants: boom");
  });
});

describe("getPayments", () => {
  it("derives payment_month and rent_month from the raw month column", async () => {
    mockSupabaseFrom(fromMock, { data: [{ tenant_id: "t1", month: "2026-07" }] });

    const result = await getPayments<Row>();

    expect(result).toEqual([
      { tenant_id: "t1", month: "2026-07", payment_month: "2026-07", rent_month: "2026-06" },
    ]);
  });

  it("derives an empty payment_month and rent_month when month is missing", async () => {
    mockSupabaseFrom(fromMock, { data: [{ tenant_id: "t1", month: null }] });

    const result = await getPayments<Row>();

    expect(result).toEqual([
      { tenant_id: "t1", month: null, payment_month: "", rent_month: "" },
    ]);
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getPayments<Row>()).rejects.toThrow("Failed to fetch payments: boom");
  });
});

describe("insertPayment", () => {
  it("inserts without throwing on success", async () => {
    mockSupabaseFrom(fromMock, { error: null });
    await expect(
      insertPayment({ tenant_id: "t1", month: "2026-07", paid_on: "2026-07-03" })
    ).resolves.toBeUndefined();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(
      insertPayment({ tenant_id: "t1", month: "2026-07", paid_on: "2026-07-03" })
    ).rejects.toThrow("Failed to insert payment: boom");
  });
});

describe("getExpenses", () => {
  it("returns expenses ordered by expense_date descending", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: [{ id: "e1" }] });

    const result = await getExpenses<Row>();

    expect(result).toEqual([{ id: "e1" }]);
    expect(builder.order).toHaveBeenCalledWith("expense_date", { ascending: false });
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getExpenses<Row>()).rejects.toThrow("Failed to fetch expenses: boom");
  });
});

describe("insertExpense", () => {
  it("returns the inserted row on success", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "e1" } });

    await expect(
      insertExpense({
        expense_date: "2026-07-15",
        item_name: "Milk",
        category: "Groceries",
        amount: 60,
        payment_method: "UPI",
      })
    ).resolves.toEqual({ id: "e1" });
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });

    await expect(
      insertExpense({
        expense_date: "2026-07-15",
        item_name: "Milk",
        category: "Groceries",
        amount: 60,
        payment_method: "UPI",
      })
    ).rejects.toThrow("Failed to insert expense: boom");
  });
});

describe("updateExpense", () => {
  it("always injects a fresh updated_at, even when the patch omits it", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: { id: "e1" } });

    await updateExpense("e1", { amount: 100 });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100, updated_at: expect.any(String) })
    );
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(updateExpense("e1", { amount: 100 })).rejects.toThrow(
      "Failed to update expense: boom"
    );
  });
});

describe("deleteExpense", () => {
  it("resolves without throwing on success", async () => {
    mockSupabaseFrom(fromMock, { error: null });
    await expect(deleteExpense("e1")).resolves.toBeUndefined();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(deleteExpense("e1")).rejects.toThrow("Failed to delete expense: boom");
  });
});

describe("getExpenseItems", () => {
  it("applies the active-only filter by default", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: [] });

    await getExpenseItems<Row>();

    expect(builder.eq).toHaveBeenCalledWith("active", true);
  });

  it("skips the active-only filter when includeInactive is true", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: [] });

    await getExpenseItems<Row>(true);

    expect(builder.eq).not.toHaveBeenCalled();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getExpenseItems<Row>()).rejects.toThrow(
      "Failed to fetch expense items: boom"
    );
  });
});

describe("insertExpenseItem", () => {
  it("returns the inserted row on success", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "i1" } });
    await expect(
      insertExpenseItem({ name: "Milk", category: "Groceries" })
    ).resolves.toEqual({ id: "i1" });
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(
      insertExpenseItem({ name: "Milk", category: "Groceries" })
    ).rejects.toThrow("Failed to insert expense item: boom");
  });
});

describe("updateExpenseItem", () => {
  it("returns the updated row on success", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "i1", active: false } });
    await expect(updateExpenseItem("i1", { active: false })).resolves.toEqual({
      id: "i1",
      active: false,
    });
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(updateExpenseItem("i1", { active: false })).rejects.toThrow(
      "Failed to update expense item: boom"
    );
  });
});

describe("isExpenseItemInUse", () => {
  it("returns false when count is 0", async () => {
    mockSupabaseFrom(fromMock, { count: 0 });
    await expect(isExpenseItemInUse("i1")).resolves.toBe(false);
  });

  it("returns true when count is greater than 0", async () => {
    mockSupabaseFrom(fromMock, { count: 3 });
    await expect(isExpenseItemInUse("i1")).resolves.toBe(true);
  });

  it("returns false when count is null", async () => {
    mockSupabaseFrom(fromMock, { count: null });
    await expect(isExpenseItemInUse("i1")).resolves.toBe(false);
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(isExpenseItemInUse("i1")).rejects.toThrow(
      "Failed to check expense item usage: boom"
    );
  });
});

describe("deleteExpenseItem", () => {
  it("resolves without throwing on success", async () => {
    mockSupabaseFrom(fromMock, { error: null });
    await expect(deleteExpenseItem("i1")).resolves.toBeUndefined();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(deleteExpenseItem("i1")).rejects.toThrow(
      "Failed to delete expense item: boom"
    );
  });
});

describe("getExpenseCategories", () => {
  it("orders by sort_order then name, and applies the active-only filter by default", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: [] });

    await getExpenseCategories<Row>();

    expect(builder.order).toHaveBeenNthCalledWith(1, "sort_order");
    expect(builder.order).toHaveBeenNthCalledWith(2, "name");
    expect(builder.eq).toHaveBeenCalledWith("active", true);
  });

  it("skips the active-only filter when includeInactive is true", async () => {
    const builder = mockSupabaseFromOnce(fromMock, { data: [] });

    await getExpenseCategories<Row>(true);

    expect(builder.eq).not.toHaveBeenCalled();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getExpenseCategories<Row>()).rejects.toThrow(
      "Failed to fetch expense categories: boom"
    );
  });
});

describe("insertExpenseCategory", () => {
  it("uses the explicitly provided sort_order without a lookup query", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "c1", sort_order: 5 } });

    await insertExpenseCategory({ name: "Rent", icon: "🏠", sort_order: 5 });

    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("auto-increments from the existing max sort_order when omitted", async () => {
    mockSupabaseFrom(fromMock, { data: { sort_order: 4 } });
    const insertBuilder = mockSupabaseFromOnce(fromMock, { data: { id: "c1" } });

    await insertExpenseCategory({ name: "Rent", icon: "🏠" });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 5 })
    );
  });

  it("starts at 0 when there are no existing categories", async () => {
    mockSupabaseFrom(fromMock, { data: null });
    const insertBuilder = mockSupabaseFromOnce(fromMock, { data: { id: "c1" } });

    await insertExpenseCategory({ name: "Rent", icon: "🏠" });

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: 0 })
    );
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(
      insertExpenseCategory({ name: "Rent", icon: "🏠", sort_order: 0 })
    ).rejects.toThrow("Failed to insert expense category: boom");
  });
});

describe("getExpenseCategoryById", () => {
  it("returns the category when found", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "c1", name: "Rent" } });
    await expect(getExpenseCategoryById<Row>("c1")).resolves.toEqual({
      id: "c1",
      name: "Rent",
    });
  });

  it("returns null when not found", async () => {
    mockSupabaseFrom(fromMock, { data: null });
    await expect(getExpenseCategoryById<Row>("missing")).resolves.toBeNull();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(getExpenseCategoryById<Row>("c1")).rejects.toThrow(
      "Failed to fetch expense category: boom"
    );
  });
});

describe("updateExpenseCategory", () => {
  it("returns the updated row on success", async () => {
    mockSupabaseFrom(fromMock, { data: { id: "c1", name: "New name" } });
    await expect(updateExpenseCategory("c1", { name: "New name" })).resolves.toEqual({
      id: "c1",
      name: "New name",
    });
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(updateExpenseCategory("c1", { name: "New name" })).rejects.toThrow(
      "Failed to update expense category: boom"
    );
  });
});

describe("isExpenseCategoryInUse", () => {
  it("returns false when neither items nor expenses reference the category", async () => {
    mockSupabaseFrom(fromMock, { count: 0 }, { count: 0 });
    await expect(isExpenseCategoryInUse("Rent")).resolves.toBe(false);
  });

  it("returns true when only expense_items reference the category", async () => {
    mockSupabaseFrom(fromMock, { count: 2 }, { count: 0 });
    await expect(isExpenseCategoryInUse("Rent")).resolves.toBe(true);
  });

  it("returns true when only expenses reference the category", async () => {
    mockSupabaseFrom(fromMock, { count: 0 }, { count: 2 });
    await expect(isExpenseCategoryInUse("Rent")).resolves.toBe(true);
  });

  it("returns true when both tables reference the category", async () => {
    mockSupabaseFrom(fromMock, { count: 2 }, { count: 2 });
    await expect(isExpenseCategoryInUse("Rent")).resolves.toBe(true);
  });

  it("surfaces the items-table error even when the expenses query succeeds", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "items boom" } }, { count: 0 });
    await expect(isExpenseCategoryInUse("Rent")).rejects.toThrow(
      "Failed to check expense category usage: items boom"
    );
  });

  it("surfaces the expenses-table error when only it fails", async () => {
    mockSupabaseFrom(fromMock, { count: 0 }, { error: { message: "expenses boom" } });
    await expect(isExpenseCategoryInUse("Rent")).rejects.toThrow(
      "Failed to check expense category usage: expenses boom"
    );
  });
});

describe("deleteExpenseCategory", () => {
  it("resolves without throwing on success", async () => {
    mockSupabaseFrom(fromMock, { error: null });
    await expect(deleteExpenseCategory("c1")).resolves.toBeUndefined();
  });

  it("throws with a diagnostic prefix on error", async () => {
    mockSupabaseFrom(fromMock, { error: { message: "boom" } });
    await expect(deleteExpenseCategory("c1")).rejects.toThrow(
      "Failed to delete expense category: boom"
    );
  });
});

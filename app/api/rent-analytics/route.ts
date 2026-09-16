import { getPayments, getTenants } from "@/lib/db";
import { buildRentAnalytics } from "@/lib/rent-analytics";
import { currentDate } from "@/lib/date";
import { hasUserSession } from "@/lib/admin-auth";
import type { Payment } from "@/types/payment";
import type { Tenant } from "@/types/tenant";
import { NextResponse } from "next/server";

export const DEFAULT_WINDOW_MONTHS = 12;
export const MAX_WINDOW_MONTHS = 36;

/**
 * Everything the rent insights screen needs, in one response, already derived
 * — so refocusing a month on the client is instant and no derivation leaks
 * into the components.
 *
 * Totals are open, the same as the dashboard's. Anything that names a tenant
 * (who paid when, behaviour, deposits, alerts, upcoming increases) needs a
 * user-level session, matching GET /api/tenant-payments/[id]; `unlocked`
 * tells the client which it got.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requested = Number(searchParams.get("months"));
  const windowMonths =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(Math.floor(requested), MAX_WINDOW_MONTHS)
      : DEFAULT_WINDOW_MONTHS;

  try {
    const [tenants, payments] = await Promise.all([
      getTenants<Tenant>(),
      getPayments<Payment>(),
    ]);

    return NextResponse.json(
      buildRentAnalytics(tenants, payments, {
        today: currentDate(),
        windowMonths,
        unlocked: hasUserSession(req),
      })
    );
  } catch (err) {
    console.error("Rent analytics failed:", err);
    return NextResponse.json(
      { error: "Failed to build rent analytics" },
      { status: 500 }
    );
  }
}

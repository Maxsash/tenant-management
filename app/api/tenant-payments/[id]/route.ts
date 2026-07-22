// app/api/tenant-payments/[id]/route.ts

import { getPayments, getTenants } from "@/lib/db";
import { calculateRent, getRentMonth } from "@/lib/rent";
import { evaluatePaymentStatus } from "@/lib/payment-status";
import { NextResponse } from "next/server";
import { Tenant } from "@/types/tenant";
import { Payment } from "@/types/payment";

const GLOBAL_CUTOFF = "2023-12";

// Payment before 8th = on time
const ON_TIME_DAY_LIMIT = 7;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    // FETCH DATA
    const allPayments =
      await getPayments<Payment>();

    const tenants =
      await getTenants<Tenant>();

    const tenant = tenants.find(
      (t) => t.id === tenantId
    );

    if (!tenant) {
      return NextResponse.json(
        {
          error: "Tenant not found",
        },
        { status: 404 }
      );
    }

    // FILTER + NORMALIZE PAYMENTS
    const tenantPayments = allPayments
      .filter((p) => {
        // wrong tenant
        if (p.tenant_id !== tenantId) {
          return false;
        }

        // invalid month
        if (!p.month) {
          return false;
        }

        const paymentMonth = String(p.month ?? p.payment_month ?? "").slice(0, 7);

        // before cutoff
        return (
          paymentMonth >=
          GLOBAL_CUTOFF
        );
      })

      .map((p) => {
        const payment_month = String(p.month ?? p.payment_month ?? "").slice(0, 7);
        const rentMonth = getRentMonth(payment_month);

        const amount = calculateRent(tenant, rentMonth);

        const paymentStatus = evaluatePaymentStatus({
          tenant,
          payments: [p],
          rentMonth,
          onTimeDayLimit: ON_TIME_DAY_LIMIT,
        });

        return {
          id: p.id || `payment_${Date.now()}`,

          tenant_id: String(p.tenant_id),

          amount,

          paid_on: paymentStatus.paid_on,

          // include both for clarity
          payment_month,
          rent_month: rentMonth,

          status: paymentStatus.status,

          isLate: paymentStatus.isLate,

          method: p.method || "Bank Transfer",

          receipt_url: p.receipt_url || undefined,
        };
      });

    // SORT NEWEST FIRST
    tenantPayments.sort((a, b) => {
      const aDate = new Date(a.paid_on || `${a.payment_month || (a as any).month || ""}-01`).getTime();

      const bDate = new Date(b.paid_on || `${b.payment_month || (b as any).month || ""}-01`).getTime();

      return bDate - aDate;
    });

    // MONTHLY BREAKDOWN
    const monthlyBreakdown =
      await generateMonthlyBreakdown(
        tenant,
        tenantPayments
      );

    // SUMMARY
    const summary = calculateSummary(
      tenantPayments,
      monthlyBreakdown
    );

    return NextResponse.json({
      payments: tenantPayments,
      summary,
      monthlyBreakdown,
      dataFrom: GLOBAL_CUTOFF,
    });
  } catch (error) {
    console.error(
      "Error fetching payment history:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch payment history",
      },
      { status: 500 }
    );
  }
}

async function generateMonthlyBreakdown(
  tenant: Tenant,
  payments: any[]
) {
  if (!tenant) {
    return [];
  }

  const breakdown: any[] = [];

  // tenant_since expected YYYY-MM
  const tenantSince = tenant
    .tenant_since
    ? String(
        tenant.tenant_since
      ).slice(0, 7)
    : GLOBAL_CUTOFF;

  // later of:
  // - global cutoff
  // - tenant onboarding
  const startMonth =
    tenantSince > GLOBAL_CUTOFF
      ? tenantSince
      : GLOBAL_CUTOFF;

  const [startYear, startMonthNum] =
    startMonth.split("-");

  let current = new Date(
    Number(startYear),
    Number(startMonthNum) - 1,
    1
  );

  const now = new Date();

  // Rent for month M is due the following month (1st-7th),
  // so the current calendar month's rent isn't due yet.
  const end = new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1
  );

  while (current <= end) {
    const rentMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;

    const paymentStatus = evaluatePaymentStatus({
      tenant,
      payments,
      rentMonth,
      onTimeDayLimit: ON_TIME_DAY_LIMIT,
    });

    const amount = calculateRent(tenant, rentMonth);

    breakdown.push({
      month: rentMonth,
      amount,
      status: paymentStatus.status,
      paid_on: paymentStatus.paid_on,
      isLate: paymentStatus.isLate,
    });

    // NEVER mutate Date objects
    current = new Date(
      current.getFullYear(),
      current.getMonth() + 1,
      1
    );
  }

  return breakdown.reverse();
}

function calculateSummary(
  payments: any[],
  monthlyBreakdown: any[]
) {
  const paidPayments =
    payments.filter(
      (p: any) =>
        p.status === "paid"
    );

  const latePayments =
    payments.filter(
      (p: any) =>
        p.status === "late"
    );

  const allSuccessfulPayments =
    [...paidPayments, ...latePayments];

  const totalPaid =
    allSuccessfulPayments.reduce(
      (
        sum: number,
        p: any
      ) => sum + p.amount,
      0
    );

  const pendingMonths =
    monthlyBreakdown.filter(
      (m: any) =>
        m.status === "pending"
    );

  const totalPending =
    pendingMonths.reduce(
      (
        sum: number,
        m: any
      ) => sum + m.amount,
      0
    );

  const expectedMonthsCount =
    monthlyBreakdown.length;

  return {
    totalPaid,

    totalPending,

    // ON-TIME ONLY
    onTimeCount:
      paidPayments.length,

    // LATE PAYMENTS
    latePaymentCount:
      latePayments.length,

    totalExpected:
      expectedMonthsCount,

    onTimePercentage:
      expectedMonthsCount > 0
        ? Math.round(
            (paidPayments.length /
              expectedMonthsCount) *
              100
          )
        : 0,

    lastPaymentDate:
      allSuccessfulPayments[0]
        ?.paid_on,

    averagePaymentAmount:
      allSuccessfulPayments.length > 0
        ? Math.round(
            totalPaid /
              allSuccessfulPayments.length
          )
        : 0,
  };
}
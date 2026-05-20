// app/api/tenant-payments/[id]/route.ts

import { getSheetRows } from "@/lib/sheets";
import { calculateRent } from "@/lib/rent";
import { NextResponse } from "next/server";

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
      await getSheetRows("payments");

    const tenants =
      await getSheetRows("tenants");

    const tenant = tenants.find(
      (t: any) =>
        String(t.id) ===
        String(tenantId)
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
      .filter((p: any) => {
        // wrong tenant
        if (
          String(p.tenant_id) !==
          String(tenantId)
        ) {
          return false;
        }

        // invalid month
        if (!p.month) {
          return false;
        }

        const paymentMonth = String(
          p.month
        ).slice(0, 7);

        // before cutoff
        return (
          paymentMonth >=
          GLOBAL_CUTOFF
        );
      })

      .map((p: any) => {
        const month = String(
          p.month
        ).slice(0, 7);

        const amount = calculateRent(
          tenant,
          month
        );

        const paidDate = p.paid_on
          ? new Date(p.paid_on)
          : null;

        const paidDay = paidDate
          ? paidDate.getDate()
          : null;

        const isLate = (() => {
        if (!paidDate) {
            return false;
        }

        const paymentMonth = month; // YYYY-MM

        const paidYearMonth = `${paidDate.getFullYear()}-${String(
            paidDate.getMonth() + 1
        ).padStart(2, "0")}`;

        // Paid in a future month
        if (paidYearMonth > paymentMonth) {
            return true;
        }

        // Paid in same month but after cutoff date
        if (
            paidYearMonth === paymentMonth &&
            paidDate.getDate() > ON_TIME_DAY_LIMIT
        ) {
            return true;
        }

        return false;
        })();


        return {
          id:
            p.id ||
            `payment_${Date.now()}`,

          tenant_id: String(
            p.tenant_id
          ),

          // derive rent automatically
          amount,

          paid_on: p.paid_on,

          month,

          // NEW STATUS SYSTEM
          status: isLate
            ? "late"
            : "paid",

          isLate,

          method:
            p.method ||
            "Bank Transfer",

          receipt_url:
            p.receipt_url ||
            undefined,
        };
      });

    // SORT NEWEST FIRST
    tenantPayments.sort((a, b) => {
      const aDate = new Date(
        a.paid_on ||
          `${a.month}-01`
      ).getTime();

      const bDate = new Date(
        b.paid_on ||
          `${b.month}-01`
      ).getTime();

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
  tenant: any,
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

  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  while (current <= end) {
    const monthStr = `${current.getFullYear()}-${String(
      current.getMonth() + 1
    ).padStart(2, "0")}`;

    const payment = payments.find(
      (p: any) =>
        String(p.month).slice(0, 7) ===
        monthStr
    );

    const amount = calculateRent(
      tenant,
      monthStr
    );

    breakdown.push({
      month: monthStr,

      amount,

      status: payment
        ? payment.status // paid | late
        : "pending",

      paid_on:
        payment?.paid_on || null,

      isLate:
        payment?.isLate || false,
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

  const totalExpected =
    monthlyBreakdown.reduce(
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

    totalPending:
      totalExpected - totalPaid,

    // ON-TIME ONLY
    onTimeCount:
      paidPayments.length,

    // LATE PAYMENTS
    latePaymentCount:
      latePayments.length,

    totalExpected:
      expectedMonthsCount,

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
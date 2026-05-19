// app/api/tenant-payments/[id]/route.ts

import { getSheetRows } from "@/lib/sheets";
import { calculateRent } from "@/lib/rent";
import { NextResponse } from "next/server";

const GLOBAL_CUTOFF = "2023-12";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;

    const allPayments = await getSheetRows("payments");

    // FILTER PAYMENTS
    const tenantPayments = allPayments
      .filter((p: any) => {
        if (
          String(p.tenant_id) !==
          String(tenantId)
        ) {
          return false;
        }

        if (!p.month) {
          return false;
        }

        const paymentMonth = String(
          p.month
        ).slice(0, 7);

        return paymentMonth >= GLOBAL_CUTOFF;
      })
      .map((p: any) => ({
        id:
          p.id ||
          `payment_${Date.now()}`,
        tenant_id: String(p.tenant_id),
        amount: Number(p.amount) || 0,
        paid_on: p.paid_on,
        month: String(p.month).slice(0, 7),
        status: "success",
        method:
          p.method ||
          "Bank Transfer",
        receipt_url:
          p.receipt_url || undefined,
      }));

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

    // GET TENANT
    const tenants =
      await getSheetRows("tenants");

    const tenant = tenants.find(
      (t: any) =>
        String(t.id) ===
        String(tenantId)
    );

    const monthlyBreakdown =
      await generateMonthlyBreakdown(
        tenant,
        tenantPayments
      );

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

  // tenant_since should be YYYY-MM
  const tenantSince = tenant.tenant_since
    ? String(tenant.tenant_since).slice(
        0,
        7
      )
    : GLOBAL_CUTOFF;

  // START MONTH = LATER OF:
  // - GLOBAL CUTOFF
  // - TENANT ONBOARD DATE
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

    breakdown.push({
      month: monthStr,
      amount: calculateRent(
        tenant,
        monthStr
      ),
      status: payment
        ? "paid"
        : "pending",
      paid_on:
        payment?.paid_on || null,
    });

    // IMPORTANT:
    // NEVER MUTATE DATE OBJECTS
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
  const successfulPayments =
    payments.filter(
      (p: any) =>
        p.status === "success"
    );

  const totalPaid =
    successfulPayments.reduce(
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

    onTimeCount:
      successfulPayments.length,

    totalExpected:
      expectedMonthsCount,

    lastPaymentDate:
      successfulPayments[0]
        ?.paid_on,

    averagePaymentAmount:
      successfulPayments.length > 0
        ? totalPaid /
          successfulPayments.length
        : 0,
  };
}
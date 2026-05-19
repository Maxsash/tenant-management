// app/api/tenant-payments/[id]/route.ts
import { getSheetRows } from "@/lib/sheets";
import { calculateRent } from "@/lib/rent";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params Promise to get the id
    const { id: tenantId } = await params;
    
    // Fetch all payments from Google Sheets
    const allPayments = await getSheetRows("payments");
    
    // Filter payments for specific tenant
    const tenantPayments = allPayments
      .filter((p: any) => String(p.tenant_id) === String(tenantId))
      .map((p: any) => ({
        id: p.id || `payment_${Date.now()}`,
        tenant_id: String(p.tenant_id),
        amount: Number(p.amount) || 0,
        paid_on: p.paid_on,
        month: p.month,
        status: p.paid_on ? 'success' : 'pending',
        method: p.method || 'Bank Transfer',
        receipt_url: p.receipt_url || undefined,
      }));
    
    // Sort by date (newest first)
    tenantPayments.sort((a, b) => 
      new Date(b.paid_on).getTime() - new Date(a.paid_on).getTime()
    );
    
    // Get tenant details
    const tenants = await getSheetRows("tenants");
    const tenant = tenants.find((t: any) => String(t.id) === String(tenantId));
    
    // Generate monthly breakdown
    const monthlyBreakdown = await generateMonthlyBreakdown(tenant, tenantPayments);
    
    // Calculate summary statistics
    const summary = calculateSummary(tenantPayments, monthlyBreakdown);
    
    return NextResponse.json({
      payments: tenantPayments,
      summary,
      monthlyBreakdown,
    });
    
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    );
  }
}

async function generateMonthlyBreakdown(tenant: any, payments: any[]) {
  if (!tenant) return [];
  
  const breakdown: any[] = [];
  const startDate = tenant.tenant_since ? new Date(tenant.tenant_since) : new Date();
  const currentDate = new Date();
  
  // Generate months from tenant start to current month
  let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  
  while (currentMonth <= endMonth) {
    const monthStr = currentMonth.toISOString().slice(0, 7);
    const payment = payments.find((p: any) => p.month === monthStr);
    const expectedAmount = tenant ? calculateRent(tenant, monthStr) : 0;
    
    breakdown.push({
      month: monthStr,
      amount: expectedAmount,
      status: payment?.paid_on ? 'paid' : 'pending',
      paid_on: payment?.paid_on,
    });
    
    // Move to next month
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  return breakdown.reverse(); // Show most recent first
}

function calculateSummary(payments: any[], monthlyBreakdown: any[]) {
  const successfulPayments = payments.filter((p: any) => p.status === 'success');
  const totalPaid = successfulPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  
  const totalExpected = monthlyBreakdown.reduce((sum: number, m: any) => sum + m.amount, 0);
  
  return {
    totalPaid,
    totalPending: totalExpected - totalPaid,
    onTimeCount: successfulPayments.length,
    totalExpected: monthlyBreakdown.length,
    lastPaymentDate: successfulPayments[0]?.paid_on,
    averagePaymentAmount: successfulPayments.length > 0 
      ? totalPaid / successfulPayments.length 
      : 0,
  };
}
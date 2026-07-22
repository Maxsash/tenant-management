// services/paymentHistory.ts

export interface Payment {
  id: string;

  tenant_id: string;

  amount: number;

  paid_on: string;

  month: string;

  // UPDATED
  status:
    | "paid"
    | "late"
    | "pending";

  isLate?: boolean;

  method?: string;

  receipt_url?: string;
}

export interface PaymentSummary {
  totalPaid: number;

  totalPending: number;

  onTimeCount: number;

  latePaymentCount: number;

  totalExpected: number;

  onTimePercentage: number;

  lastPaymentDate?: string;

  averagePaymentAmount: number;
}

export interface MonthlyPayment {
  month: string;

  amount: number;

  // UPDATED
  status:
    | "paid"
    | "late"
    | "pending";

  paid_on?: string;

  isLate?: boolean;
}

export interface PaymentHistoryData {
  payments: Payment[];

  summary: PaymentSummary;

  monthlyBreakdown: MonthlyPayment[];

  dataFrom?: string;
}

class PaymentHistory {
  async getTenantPaymentHistory(
    tenantId: string
  ): Promise<PaymentHistoryData> {
    const response = await fetch(
      `/api/tenant-payments/${tenantId}`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to fetch payment history"
      );
    }

    return response.json();
  }

  async getCurrentMonthStatus(
    tenantId: string
  ): Promise<{
    isPaid: boolean;
    paidOn?: string;
    amount: number;
    dueDate: string;
  }> {
    const response = await fetch(
      `/api/tenant-payments/${tenantId}/current-month`
    );

    if (!response.ok) {
      throw new Error(
        "Failed to fetch current month status"
      );
    }

    return response.json();
  }
}

export const paymentHistory =
  new PaymentHistory();
export interface Tenant {
  id: string;
  name: string;
  // Omitted from /api/dashboard responses unless the caller has a valid
  // admin session — see app/api/dashboard/route.ts.
  phone?: string;
  property_type: string;
  tenant_since?: string;
  vacated_on?: string;
  active: boolean;
  base_rent: number | string;
  base_rent_as_of?: string;
  security_deposit?: number | string;
  bank?: string;
  increase_month?: string;
  increase_type?: "multiplier" | "flat" | string;
  increase_by?: number | string;
}

export interface TenantDashboardItem extends Tenant {
  amount: number;
  paid: boolean;
  paid_on: string | null;
}
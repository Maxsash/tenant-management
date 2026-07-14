export interface Tenant {
  id: string;
  name: string;
  phone: string;
  property_type: string;
  tenant_since?: string;
  vacated_on?: string;
  active: "TRUE" | "FALSE";
  base_rent: number;
  base_rent_as_of?: string;
  security_deposit?: number;
  bank?: string;
  increase_month?: string;
  increase_type?: "multiplier" | "flat";
  increase_by?: number;
}

export interface TenantDashboardItem extends Tenant {
  amount: number;
  paid: boolean;
  paid_on: string | null;
}
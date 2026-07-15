export type TenantActiveValue = boolean | string | number;

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  property_type: string;
  tenant_since?: string;
  vacated_on?: string;
  active: TenantActiveValue;
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
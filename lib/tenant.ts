import { Tenant } from "@/types/tenant";

export function getActiveTenants(
  tenants: Tenant[],
  month: string
): Tenant[] {
  return tenants.filter((tenant) => {
    if (tenant.tenant_since) {
      const onboardMonth = tenant.tenant_since.slice(0, 7);

      if (month < onboardMonth) {
        return false;
      }
    }

    if (tenant.active) {
      return true;
    }

    if (!tenant.vacated_on) {
      return false;
    }

    const vacatedMonth = tenant.vacated_on.slice(0, 7);

    return month <= vacatedMonth;
  });
}
import { Tenant } from "@/types/tenant";

function isActiveTenant(active: Tenant["active"]): boolean {
  if (typeof active === "boolean") {
    return active;
  }

  if (typeof active === "number") {
    return active === 1;
  }

  if (typeof active === "string") {
    return ["true", "TRUE", "1", "yes", "YES", "y"].includes(active.trim());
  }

  return false;
}

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

    if (isActiveTenant(tenant.active)) {
      return true;
    }

    if (!tenant.vacated_on) {
      return false;
    }

    const vacatedMonth = tenant.vacated_on.slice(0, 7);

    return month <= vacatedMonth;
  });
}
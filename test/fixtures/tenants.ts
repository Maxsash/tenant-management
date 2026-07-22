import type { Tenant } from "@/types/tenant";

export function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: "tenant-1",
    name: "Test Tenant",
    phone: "+919999999999",
    property_type: "1BHK",
    tenant_since: "2023-01-01",
    active: true,
    base_rent: 10000,
    base_rent_as_of: "2023-01-01",
    ...overrides,
  };
}

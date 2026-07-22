import { describe, expect, it } from "vitest";
import { getActiveTenants } from "./tenant";
import { makeTenant } from "@/test/fixtures/tenants";

describe("getActiveTenants", () => {
  it("includes a tenant with active: true and no tenant_since/vacated_on", () => {
    const tenant = makeTenant({ active: true, tenant_since: undefined });
    expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
  });

  it("excludes a tenant whose active is false with no vacated_on", () => {
    const tenant = makeTenant({ active: false, tenant_since: undefined });
    expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
  });

  describe("tenant_since", () => {
    it("excludes a tenant whose tenant_since is after the queried month, even if active", () => {
      const tenant = makeTenant({ active: true, tenant_since: "2026-08-01" });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
    });

    it("includes a tenant whose tenant_since is at or before the queried month", () => {
      const tenant = makeTenant({ active: true, tenant_since: "2026-07-01" });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
    });
  });

  describe("vacated_on", () => {
    it("includes an inactive tenant for the month they vacated in", () => {
      const tenant = makeTenant({ active: false, tenant_since: undefined, vacated_on: "2026-07-15" });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
    });

    it("includes an inactive tenant for months before they vacated", () => {
      const tenant = makeTenant({ active: false, tenant_since: undefined, vacated_on: "2026-07-15" });
      expect(getActiveTenants([tenant], "2026-06")).toEqual([tenant]);
    });

    it("excludes an inactive tenant for months after they vacated", () => {
      const tenant = makeTenant({ active: false, tenant_since: undefined, vacated_on: "2026-07-15" });
      expect(getActiveTenants([tenant], "2026-08")).toEqual([]);
    });

    it("documents that active:true takes unconditional priority over a past vacated_on", () => {
      // Contradictory data: marked active, but vacated_on is in the past.
      // isActiveTenant short-circuits to true before vacated_on is ever
      // inspected, so the tenant is still included. Easy to invert by
      // accident during a refactor.
      const tenant = makeTenant({
        active: true,
        tenant_since: undefined,
        vacated_on: "2020-01-01",
      });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
    });
  });
});

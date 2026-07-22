import { describe, expect, it } from "vitest";
import { getActiveTenants } from "./tenant";
import { makeTenant } from "@/test/fixtures/tenants";
import type { Tenant } from "@/types/tenant";

describe("getActiveTenants", () => {
  it("includes a tenant with active: true and no tenant_since/vacated_on", () => {
    const tenant = makeTenant({ active: true, tenant_since: undefined });
    expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
  });

  it("excludes a tenant whose active is false with no vacated_on", () => {
    const tenant = makeTenant({ active: false, tenant_since: undefined });
    expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
  });

  describe("active as a number", () => {
    it("treats exactly 1 as active", () => {
      const tenant = makeTenant({ active: 1, tenant_since: undefined });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
    });

    it("treats 0 as not active", () => {
      const tenant = makeTenant({ active: 0, tenant_since: undefined });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
    });

    it("treats any other number (e.g. 2) as not active", () => {
      const tenant = makeTenant({ active: 2, tenant_since: undefined });
      expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
    });
  });

  describe("active as a string (current exact-case allowlist)", () => {
    it.each(["true", "TRUE", "1", "yes", "YES", "y", "  true  "])(
      "treats %j as active",
      (value) => {
        const tenant = makeTenant({ active: value, tenant_since: undefined });
        expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
      }
    );

    it.each(["True", "Yes", "Y", "tRUE", "no", "", "active"])(
      "treats %j as NOT active under the current exact-case allowlist",
      (value) => {
        const tenant = makeTenant({ active: value, tenant_since: undefined });
        expect(getActiveTenants([tenant], "2026-07")).toEqual([]);
      }
    );
  });

  it("treats a non-boolean/number/string active value (e.g. null) as not active", () => {
    const tenant = makeTenant({ active: null as unknown as Tenant["active"], tenant_since: undefined });
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

  describe("deferred bugs (failing — fix pending, see plan)", () => {
    // `active` used to be free text from Google Sheets and is now a real
    // boolean column in Supabase — the string allowlist is migration-era
    // leftover. Proper handling should treat legacy string data
    // case-insensitively rather than via an exact-case allowlist, so a
    // value like "True"/"Yes"/"Y" (plausible from old imported data) isn't
    // silently treated as inactive.
    it.each(["True", "Yes", "Y"])(
      "[KNOWN BUG] treats %j as active (case-insensitive), not just the exact-case allowlist",
      (value) => {
        const tenant = makeTenant({ active: value, tenant_since: undefined });
        expect(getActiveTenants([tenant], "2026-07")).toEqual([tenant]);
      }
    );
  });
});

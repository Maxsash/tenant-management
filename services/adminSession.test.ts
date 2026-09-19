import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin session client cache", () => {
  it("shares one status request and reuses its result across callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ level: "admin" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const {
      getAdminSessionStatus,
      getCachedAdminSessionStatus,
    } = await import("./adminSession");

    expect(getCachedAdminSessionStatus()).toBeUndefined();

    await expect(
      Promise.all([getAdminSessionStatus(), getAdminSessionStatus()])
    ).resolves.toEqual(["admin", "admin"]);
    await expect(getAdminSessionStatus()).resolves.toBe("admin");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedAdminSessionStatus()).toBe("admin");
  });

  it("updates the shared cache after a successful PIN unlock", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ level: "user" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const {
      getAdminSessionStatus,
      getCachedAdminSessionStatus,
      unlockAdminSession,
    } = await import("./adminSession");

    await expect(unlockAdminSession("1234")).resolves.toBe("user");
    await expect(getAdminSessionStatus()).resolves.toBe("user");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getCachedAdminSessionStatus()).toBe("user");
  });
});

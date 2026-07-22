import { afterEach, describe, expect, it } from "vitest";
import { isAdminActionsEnabled } from "./config";

const ORIGINAL = process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS;

afterEach(() => {
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS = ORIGINAL;
});

describe("isAdminActionsEnabled", () => {
  it("returns true when the env var is exactly 'true'", () => {
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS = "true";
    expect(isAdminActionsEnabled()).toBe(true);
  });

  it("returns false when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS;
    expect(isAdminActionsEnabled()).toBe(false);
  });

  it("returns false for any other value", () => {
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS = "yes";
    expect(isAdminActionsEnabled()).toBe(false);
  });
});

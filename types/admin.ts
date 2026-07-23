// "admin" satisfies anything "user" gates, plus admin-only actions — see
// lib/admin-auth.ts#hasUserSession/hasAdminSession for the hierarchy.
export type AdminLevel = "user" | "admin";

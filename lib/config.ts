export function isAdminActionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS === "true";
}

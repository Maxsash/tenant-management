"use client";

import { useCallback, useRef, useState } from "react";
import { getAdminSessionStatus, unlockAdminSession } from "@/services/adminSession";
import type { AdminLevel } from "@/types/admin";

// Hierarchical: an admin-level session satisfies a user-level requirement too.
function meetsLevel(have: AdminLevel | null, need: AdminLevel): boolean {
  return have === "admin" || have === need;
}

export function useAdminUnlock() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState<AdminLevel>("admin");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const promptForUnlock = useCallback(async (level: AdminLevel): Promise<boolean> => {
    const current = await getAdminSessionStatus();
    if (meetsLevel(current, level)) return true;

    setError(null);
    setRequiredLevel(level);
    setOpen(true);

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleSubmit = useCallback(
    async (pin: string) => {
      setSubmitting(true);
      setError(null);

      const level = await unlockAdminSession(pin);

      setSubmitting(false);

      if (meetsLevel(level, requiredLevel)) {
        setOpen(false);
        resolverRef.current?.(true);
        resolverRef.current = null;
      } else if (level) {
        // A real PIN, just not the right tier for this action.
        setError(
          requiredLevel === "admin"
            ? "That's the family PIN — this needs the admin PIN"
            : "Incorrect PIN"
        );
      } else {
        setError("Incorrect PIN");
      }
    },
    [requiredLevel]
  );

  const handleCancel = useCallback(() => {
    setOpen(false);
    resolverRef.current?.(false);
    resolverRef.current = null;
  }, []);

  return {
    promptForUnlock,
    pinDialogProps: {
      open,
      error,
      submitting,
      requiredLevel,
      onSubmit: handleSubmit,
      onCancel: handleCancel,
    },
  };
}

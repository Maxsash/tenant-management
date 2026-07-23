"use client";

import { useCallback, useRef, useState } from "react";
import { unlockAdminSession } from "@/services/adminSession";

export function useAdminUnlock() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const promptForUnlock = useCallback((): Promise<boolean> => {
    setError(null);
    setOpen(true);

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleSubmit = useCallback(async (pin: string) => {
    setSubmitting(true);
    setError(null);

    const ok = await unlockAdminSession(pin);

    setSubmitting(false);

    if (ok) {
      setOpen(false);
      resolverRef.current?.(true);
      resolverRef.current = null;
    } else {
      setError("Incorrect PIN");
    }
  }, []);

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
      onSubmit: handleSubmit,
      onCancel: handleCancel,
    },
  };
}

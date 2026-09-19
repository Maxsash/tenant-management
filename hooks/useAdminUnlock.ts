"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAdminSessionStatus,
  getCachedAdminSessionStatus,
  unlockAdminSession,
} from "@/services/adminSession";
import type { AdminLevel } from "@/types/admin";

// Hierarchical: an admin-level session satisfies a user-level requirement too.
function meetsLevel(have: AdminLevel | null, need: AdminLevel): boolean {
  return have === "admin" || have === need;
}

export function useAdminUnlock() {
  const cachedLevel = getCachedAdminSessionStatus();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requiredLevel, setRequiredLevel] = useState<AdminLevel>("admin");
  const [sessionLevel, setSessionLevel] = useState<
    AdminLevel | null | undefined
  >(cachedLevel);
  const sessionLevelRef = useRef<AdminLevel | null | undefined>(cachedLevel);
  const requiredLevelRef = useRef<AdminLevel>("admin");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  // Resolve the existing cookie while the page is becoming usable, not after
  // somebody taps an action. If they tap unusually quickly, the PIN opens at
  // once; a valid session discovered in flight closes it and continues.
  useEffect(() => {
    if (sessionLevelRef.current !== undefined) return;

    let cancelled = false;

    getAdminSessionStatus()
      .catch(() => null)
      .then((level) => {
        if (cancelled) return;
        // A PIN submitted while this request was in flight is newer than the
        // page-load snapshot and must not be overwritten by it.
        if (sessionLevelRef.current !== undefined) return;

        sessionLevelRef.current = level;
        setSessionLevel(level);

        if (resolverRef.current && meetsLevel(level, requiredLevelRef.current)) {
          setOpen(false);
          resolverRef.current(true);
          resolverRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const promptForUnlock = useCallback((level: AdminLevel): Promise<boolean> => {
    const current = sessionLevelRef.current;
    if (current !== undefined && meetsLevel(current, level)) {
      return Promise.resolve(true);
    }

    setError(null);
    requiredLevelRef.current = level;
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

      try {
        const level = await unlockAdminSession(pin);

        if (level) {
          sessionLevelRef.current = level;
          setSessionLevel(level);
        }

        if (meetsLevel(level, requiredLevel)) {
          setOpen(false);
          resolverRef.current?.(true);
          resolverRef.current = null;
        } else if (level) {
          // A real PIN, just not the right tier for what was tapped.
          setError(
            requiredLevel === "admin"
              ? "That's the family PIN — this needs the admin PIN"
              : "Incorrect PIN"
          );
        } else {
          setError("Incorrect PIN");
        }
      } catch {
        setError("Couldn't check the PIN. Please try again.");
      } finally {
        setSubmitting(false);
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
    sessionLevel,
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

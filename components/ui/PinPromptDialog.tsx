"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";

type Props = {
  open: boolean;
  error: string | null;
  submitting: boolean;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
};

export default function PinPromptDialog({ open, error, submitting, onSubmit, onCancel }: Props) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!open) return;
    // Deferred to a microtask so calling this from the mount/dependency
    // effect doesn't set state synchronously within the effect body
    // (react-hooks/set-state-in-effect).
    queueMicrotask(() => setPin(""));
  }, [open]);

  function submit() {
    if (pin) onSubmit(pin);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title="Enter PIN"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} disabled={!pin}>
            Unlock
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 text-sm text-muted">
          <Lock className="h-4 w-4" />
          This needs the family PIN.
        </div>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-foreground outline-none focus:border-accent"
        />

        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">{error}</p>
        )}
      </form>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, PhoneOff } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Skeleton from "@/components/ui/Skeleton";
import { getWhatsAppLinks } from "@/services/whatsapp-links";
import { formatMonthLabel } from "@/utils/date";
import { cn } from "@/utils/cn";
import type { WhatsAppLinksResponse, WhatsAppMessageKind } from "@/types/whatsapp";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
};

const KIND_OPTIONS = [
  { value: "reminder", label: "Rent reminder" },
  { value: "greeting", label: "Monthly greeting" },
];

// Tap-to-send: each row is a real link that opens WhatsApp with the message
// already typed, so sending needs no worker and works from anywhere. It has to
// be a plain <a> the person taps — opening WhatsApp from code after an await
// is treated as a popup and blocked on iPhone.
export default function WhatsAppSendSheet({ open, onOpenChange, month }: Props) {
  const [kind, setKind] = useState<WhatsAppMessageKind>("reminder");
  const [data, setData] = useState<WhatsAppLinksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Remembers which chats were opened, per month and kind, for as long as the
  // dashboard is up — so after sending and switching back from WhatsApp, the
  // list shows who is left.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    // Deferred to a microtask so the reset doesn't set state synchronously
    // within the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (cancelled) return;
      setData(null);
      setError(null);
    });

    getWhatsAppLinks(month, kind)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      });

    return () => {
      cancelled = true;
    };
  }, [open, month, kind]);

  function markOpened(id: string) {
    setOpened((prev) => new Set(prev).add(`${month}:${kind}:${id}`));
  }

  const recipients = data?.recipients ?? [];
  const monthLabel = formatMonthLabel(month);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Message on WhatsApp">
      <div className="flex flex-col gap-4">
        <SegmentedControl
          options={KIND_OPTIONS}
          value={kind}
          onChange={(value) => setKind(value as WhatsAppMessageKind)}
          ariaLabel="Message type"
        />

        <p className="text-sm text-muted">
          {kind === "reminder"
            ? `Tenants with ${monthLabel} rent pending.`
            : `Every tenant, with their ${monthLabel} rent.`}{" "}
          Tap a name to open WhatsApp with the message ready, then press send.
        </p>

        {error ? (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : !data ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recipients.length === 0 ? (
          <p className="text-sm text-muted">
            {kind === "reminder" ? "Everyone's paid up for this month." : "No active tenants this month."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recipients.map((recipient) => {
              const isOpened = opened.has(`${month}:${kind}:${recipient.id}`);

              const content = (
                <>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{recipient.name}</p>
                    <p className="text-sm text-muted">₹{recipient.rent}</p>
                  </div>

                  {!recipient.link ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted">
                      <PhoneOff className="h-4 w-4" />
                      No valid number
                    </span>
                  ) : isOpened ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Opened
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-semibold text-on-success">
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </span>
                  )}
                </>
              );

              const rowClass =
                "flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3";

              return (
                <li key={recipient.id}>
                  {recipient.link ? (
                    <a
                      href={recipient.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => markOpened(recipient.id)}
                      className={cn(
                        rowClass,
                        "transition-colors active:scale-[0.99]",
                        isOpened ? "bg-success-soft" : "bg-surface hover:bg-accent-soft"
                      )}
                    >
                      {content}
                    </a>
                  ) : (
                    <div className={cn(rowClass, "bg-surface opacity-70")}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

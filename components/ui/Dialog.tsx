"use client";

import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import WaveBand from "./sea/WaveBand";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-sea-abyss/45 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
              <RadixDialog.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "relative flex max-h-[88vh] w-full flex-col bg-surface shadow-float",
                    "sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
                  )}
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                  initial={{ y: 48, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 48, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                >
                  {/* On a phone the sheet rises from the bottom, so its top
                      edge is a wave coming in. */}
                  <WaveBand
                    band="near"
                    water="var(--color-surface)"
                    crest="var(--color-foam)"
                    drift="40s"
                    className="bottom-[calc(100%-1px)] sm:hidden"
                  />

                  <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 sm:pt-5">
                    <div className="min-w-0">
                      <RadixDialog.Title className="font-display text-xl font-semibold text-foreground">
                        {title}
                      </RadixDialog.Title>
                      {description && (
                        <RadixDialog.Description className="mt-1 text-sm text-muted">
                          {description}
                        </RadixDialog.Description>
                      )}
                      <div aria-hidden="true" className="squiggle mt-1 w-14 text-accent/60" />
                    </div>
                    <RadixDialog.Close
                      aria-label="Close"
                      className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <X className="h-5 w-5" />
                    </RadixDialog.Close>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                  {footer && (
                    <div className="border-t border-dashed border-border bg-surface-sunk/60 px-5 py-4 sm:rounded-b-2xl">
                      {footer}
                    </div>
                  )}
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}

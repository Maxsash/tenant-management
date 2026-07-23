"use client";

import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function Dialog({ open, onOpenChange, title, children, footer }: Props) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </RadixDialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
              <RadixDialog.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-surface shadow-float",
                    "sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl"
                  )}
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                  initial={{ y: 48, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 48, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                >
                  <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <RadixDialog.Title className="font-display text-lg font-semibold text-foreground">
                      {title}
                    </RadixDialog.Title>
                    <RadixDialog.Close
                      aria-label="Close"
                      className="rounded-full p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
                    >
                      <X className="h-5 w-5" />
                    </RadixDialog.Close>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                  {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
                </motion.div>
              </RadixDialog.Content>
            </div>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}

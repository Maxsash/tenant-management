"use client";

import { useId, type ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import { motion } from "motion/react";
import { cn } from "@/utils/cn";

type TabItem = { value: string; label: string };

type Props = {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
};

export default function Tabs({ items, value, onValueChange, children }: Props) {
  const layoutId = useId();

  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List className="flex border-b border-border">
        {items.map((item) => {
          const active = item.value === value;
          return (
            <RadixTabs.Trigger
              key={item.value}
              value={item.value}
              className={cn(
                "relative flex-1 py-3 text-[15px] transition-colors outline-none",
                active ? "font-semibold text-accent" : "font-medium text-muted"
              )}
            >
              {item.label}
              {active && (
                // The active tab is underlined with a drawn wave.
                <motion.div
                  layoutId={`tab-indicator-${layoutId}`}
                  className="squiggle absolute inset-x-4 -bottom-[3px] text-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
            </RadixTabs.Trigger>
          );
        })}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabsContent = RadixTabs.Content;

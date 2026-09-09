"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { cn } from "@/utils/cn";

const sections = [
  { href: "/expense", label: "Log" },
  { href: "/expense/insights", label: "Insights" },
];

/**
 * Switch between logging and reading. A labelled control rather than an icon,
 * because insights is the point of the logging, not a settings corner.
 */
export default function ExpenseSectionNav({
  className,
}: {
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn("flex gap-1 rounded-xl bg-accent-soft p-1", className)}
      role="navigation"
      aria-label="Expense sections"
    >
      {sections.map((section) => {
        const active =
          section.href === "/expense"
            ? pathname === "/expense"
            : pathname.startsWith(section.href);

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors",
              active ? "text-white" : "text-accent"
            )}
          >
            {active && (
              <motion.span
                layoutId="expense-section-nav"
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{section.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

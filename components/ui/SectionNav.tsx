"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { cn } from "@/utils/cn";

export type Section = { href: string; label: string };

type Props = {
  sections: Section[];
  ariaLabel: string;
  className?: string;
};

/**
 * Switch between the screens of one area (logging and reading, say). A
 * labelled control rather than an icon, because the insights are the point of
 * the logging, not a settings corner.
 *
 * The section whose href is the longest match for the current path is active,
 * so "/tenant/insights" lights up Insights and not also its parent "/tenant".
 */
export default function SectionNav({ sections, ariaLabel, className }: Props) {
  const pathname = usePathname();

  const active = sections
    .filter((s) => pathname === s.href || pathname.startsWith(`${s.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <div
      className={cn(
        "flex gap-1 rounded-full bg-accent-soft p-1 shadow-[inset_0_1px_3px_var(--shadow-tint-soft)]",
        className
      )}
      role="navigation"
      aria-label={ariaLabel}
    >
      {sections.map((section) => {
        const isActive = section === active;

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold transition-colors",
              isActive ? "text-on-accent" : "text-accent"
            )}
          >
            {isActive && (
              <motion.span
                // Keyed by the nav, not the instance, so the pill can glide between
                // the pages of one area.
                layoutId={`section-nav-${ariaLabel}`}
                className="absolute inset-0 rounded-full bg-accent bg-linear-to-b from-accent-bright to-accent shadow-[0_6px_14px_-8px_var(--shadow-tint-strong)]"
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

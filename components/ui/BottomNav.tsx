"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Receipt, Users } from "lucide-react";
import { cn } from "@/utils/cn";
import WaveBand from "./sea/WaveBand";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tenant", label: "Tenants", icon: Users },
  { href: "/expense", label: "Expenses", icon: Receipt },
];

/** The sea along the bottom of the phone, with a wave rolling along its top. */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-sea md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <WaveBand
        band="far"
        water="var(--color-sea)"
        crest="var(--color-sea-lit)"
        drift="48s"
        className="bottom-[calc(100%-1px)]"
      />

      <div className="relative mx-auto flex w-full max-w-md">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 pt-1.5 pb-3"
            >
              <span className="relative flex h-9 w-16 items-center justify-center">
                {active && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    className="absolute inset-0 rounded-full bg-foam shadow-[0_6px_14px_-6px_rgb(0_0_0/0.35)]"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon
                  className={cn("relative h-6 w-6", active ? "text-sea-deep" : "text-on-sea-muted")}
                  strokeWidth={active ? 2.3 : 1.8}
                />
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  active ? "font-bold text-on-sea" : "font-medium text-on-sea-muted"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

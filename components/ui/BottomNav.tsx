"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Receipt, Users } from "lucide-react";
import { cn } from "@/utils/cn";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tenant", label: "Tenants", icon: Users },
  { href: "/expense", label: "Expenses", icon: Receipt },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-md">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-1.5 py-3.5"
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-x-8 top-0 h-[3px] rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon
                className={cn("h-6 w-6", active ? "text-accent" : "text-muted")}
                strokeWidth={active ? 2.3 : 1.8}
              />
              <span
                className={cn(
                  "text-[11px] font-medium",
                  active ? "text-accent" : "text-muted"
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

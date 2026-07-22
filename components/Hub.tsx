"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Building2,
  FileText,
  Home as HomeIcon,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import Card from "@/components/ui/Card";
import PageContainer from "@/components/ui/PageContainer";

const liveApps = [
  { title: "Tenants", description: "Rent & payments", href: "/tenant", icon: Building2 },
  { title: "Expenses", description: "Household spending", href: "/expense", icon: Receipt },
];

const comingSoon = [
  { title: "Accounts", icon: Wallet },
  { title: "Family", icon: Users },
  { title: "Properties", icon: HomeIcon },
  { title: "Documents", icon: FileText },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Hub() {
  return (
    <PageContainer size="lg">
      <div className="text-center md:text-left">
        <p className="font-display text-[34px] italic leading-tight text-accent">
          Shrivastava Hub
        </p>
        <p className="mt-1 text-[15px] text-muted">Everything, in one place.</p>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={container}
      >
        {liveApps.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.title} variants={item}>
              <Link href={app.href}>
                <Card className="flex h-40 flex-col items-center justify-center gap-3 p-4 text-center transition-transform active:scale-[0.97]">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{app.title}</p>
                    <p className="text-xs text-muted">{app.description}</p>
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}

        {comingSoon.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.title} variants={item}>
              <Card className="flex h-40 flex-col items-center justify-center gap-3 border-dashed p-4 text-center opacity-60">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{app.title}</p>
                  <p className="text-xs text-muted">Coming soon</p>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </PageContainer>
  );
}

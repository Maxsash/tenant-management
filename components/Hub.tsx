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
import SeaScene from "@/components/ui/sea/SeaScene";
import WaveBand from "@/components/ui/sea/WaveBand";

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
      <header className="relative -mx-2 overflow-hidden rounded-2xl border border-border shadow-card sm:mx-0">
        <SeaScene className="h-80 sm:h-96" shore="var(--color-surface)" />

        <div className="absolute inset-x-0 top-0 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
            Maxsash Studio · Ghar
          </p>
          <h1 className="mt-2 font-display text-[40px] leading-[1.02] font-semibold text-foreground italic sm:text-5xl">
            Shrivastava
            <span className="block text-accent">Hub</span>
          </h1>
          <p className="mt-2 text-[15px] font-medium text-foreground/80">Everything, in one place.</p>
        </div>
      </header>

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
                <Card className="relative isolate flex h-44 flex-col items-center justify-center gap-3 overflow-hidden p-4 text-center transition-transform active:scale-[0.97]">
                  <div className="porthole sea-fill flex h-14 w-14 items-center justify-center rounded-full text-on-sea">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">{app.title}</p>
                    <p className="text-xs text-muted">{app.description}</p>
                  </div>
                  <WaveBand
                    band="mid"
                    water="var(--color-accent-soft)"
                    crest="color-mix(in oklab, var(--color-accent) 18%, transparent)"
                    className="-bottom-4 -z-10"
                  />
                </Card>
              </Link>
            </motion.div>
          );
        })}

        {comingSoon.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.title} variants={item}>
              {/* Uncharted water: drawn on the chart, not yet sailed to. */}
              <div className="graph-paper flex h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-accent/35 bg-surface/50 p-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-accent/40 text-accent/80">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="font-semibold text-foreground/80">{app.title}</p>
                  <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Coming soon</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </PageContainer>
  );
}

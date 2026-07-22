"use client";

import { motion } from "motion/react";

export default function PageLoader() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold bg-accent-soft font-display text-2xl italic text-accent"
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        S
      </motion.div>
      <p className="text-sm font-medium text-muted">Getting things ready…</p>
    </div>
  );
}

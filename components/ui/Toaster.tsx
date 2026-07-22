"use client";

import { Toaster as Sonner } from "sonner";

export default function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-foreground)",
        },
      }}
    />
  );
}

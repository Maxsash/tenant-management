"use client";

import { Toaster as Sonner } from "sonner";

export default function Toaster() {
  return (
    <Sonner
      position="top-center"
      // Follows the phone's light/dark setting, like the rest of the app.
      theme="system"
      toastOptions={{
        style: {
          fontFamily: "var(--font-sans)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-foreground)",
          boxShadow: "var(--shadow-float)",
        },
      }}
    />
  );
}

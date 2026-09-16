import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Toaster from "@/components/ui/Toaster";
import BottomNav from "@/components/ui/BottomNav";
import Sidebar from "@/components/ui/Sidebar";
import "./globals.css";

// The same three faces as maxsash.com, so this reads as one of its harbours.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// SOFT rounds the terminals (see .font-display in globals.css); WONK and opsz
// are loaded so the italic can lean like the "Studio" in the maxsash wordmark.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Shrivastava Hub",
  description: "Family rent and household expense tracking",
  manifest: "/manifest-hub.webmanifest",
  // Private family app — never indexed, but still reachable by anyone with
  // the link (family members share it directly, e.g. over WhatsApp).
  robots: { index: false, follow: false },
  openGraph: {
    title: "Shrivastava Hub",
    description: "Family rent and household expense tracking",
    siteName: "Shrivastava Hub",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shrivastava Hub",
    description: "Family rent and household expense tracking",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // The top of the sky in globals.css, so the status bar continues it. Light
  // or dark follows the phone's own setting; the app never asks.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#cfe8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1a2e" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Skip to main content
        </a>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <main id="main-content">{children}</main>
          </div>
        </div>
        <BottomNav />
        <Toaster />
      </body>
    </html>
  );
}

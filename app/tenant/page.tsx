import TenantHome from "@/components/tenants/TenantHome";

export const metadata = {
  title: "Tenants - Shrivastava Hub",
  description: "Rent tracking, payment status, and WhatsApp reminders",
  manifest: "/manifest-tenant.webmanifest",
  // Next doesn't deep-merge nested metadata fields across segments — a
  // segment that sets its own `openGraph`/`twitter` replaces the parent's
  // whole object, so siteName/type/locale have to be repeated here too.
  openGraph: {
    title: "Tenants - Shrivastava Hub",
    description: "Rent tracking, payment status, and WhatsApp reminders",
    siteName: "Shrivastava Hub",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tenants - Shrivastava Hub",
    description: "Rent tracking, payment status, and WhatsApp reminders",
  },
};

export default function Page() {
  return <TenantHome />;
}

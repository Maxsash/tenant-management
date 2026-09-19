import { redirect } from "next/navigation";

import ExpenseInsights from "@/components/expenses/ExpenseInsights";

export const metadata = {
  title: "Expense Insights - Shrivastava Hub",
  description: "When household items may be needed again",
  manifest: "/manifest-expense.webmanifest",
  // Next doesn't deep-merge nested metadata fields across segments — a
  // segment that sets its own `openGraph`/`twitter` replaces the parent's
  // whole object, so siteName/type/locale have to be repeated here too.
  openGraph: {
    title: "Expense Insights - Shrivastava Hub",
    description: "When household items may be needed again",
    siteName: "Shrivastava Hub",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Expense Insights - Shrivastava Hub",
    description: "When household items may be needed again",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string | string[] }>;
}) {
  // Keep old installed home-screen shortcuts working after Insights becomes
  // the default expense screen.
  if ((await searchParams).scan !== undefined) redirect("/expense/log?scan=1");

  return <ExpenseInsights />;
}

import ExpenseHome from "@/components/expenses/ExpenseHome";

export const metadata = {
  title: "Expenses - Shrivastava Hub",
  description: "Household expense logging and monthly summaries",
  manifest: "/manifest-expense.webmanifest",
  // Next doesn't deep-merge nested metadata fields across segments — a
  // segment that sets its own `openGraph`/`twitter` replaces the parent's
  // whole object, so siteName/type/locale have to be repeated here too.
  openGraph: {
    title: "Expenses - Shrivastava Hub",
    description: "Household expense logging and monthly summaries",
    siteName: "Shrivastava Hub",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Expenses - Shrivastava Hub",
    description: "Household expense logging and monthly summaries",
  },
};

export default function Page() {
  return <ExpenseHome />;
}

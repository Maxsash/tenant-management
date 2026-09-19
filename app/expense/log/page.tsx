import ExpenseHome from "@/components/expenses/ExpenseHome";

export const metadata = {
  title: "Log Expenses - Shrivastava Hub",
  description: "Log household expenses and photographed slips",
  manifest: "/manifest-expense.webmanifest",
};

export default function Page() {
  return <ExpenseHome />;
}

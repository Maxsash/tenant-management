import SectionNav from "@/components/ui/SectionNav";

const sections = [
  { href: "/expense", label: "Log" },
  { href: "/expense/insights", label: "Insights" },
];

export default function ExpenseSectionNav({ className }: { className?: string }) {
  return <SectionNav sections={sections} ariaLabel="Expense sections" className={className} />;
}

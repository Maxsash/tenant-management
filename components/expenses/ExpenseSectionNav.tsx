import SectionNav from "@/components/ui/SectionNav";

const sections = [
  { href: "/expense", label: "Insights" },
  { href: "/expense/log", label: "Log" },
];

export default function ExpenseSectionNav({ className }: { className?: string }) {
  return <SectionNav sections={sections} ariaLabel="Expense sections" className={className} />;
}

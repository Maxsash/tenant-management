import SectionNav from "@/components/ui/SectionNav";

const sections = [
  { href: "/tenant", label: "Rent" },
  { href: "/tenant/insights", label: "Insights" },
];

export default function TenantSectionNav({ className }: { className?: string }) {
  return <SectionNav sections={sections} ariaLabel="Tenant sections" className={className} />;
}

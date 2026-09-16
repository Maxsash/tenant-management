"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import LockedCard from "@/components/ui/LockedCard";
import Tabs, { TabsContent } from "@/components/ui/Tabs";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import PageLoader from "@/components/ui/PageLoader";
import PinPromptDialog from "@/components/ui/PinPromptDialog";
import ManageItemsTab from "./ManageItemsTab";
import ManageCategoriesTab from "./ManageCategoriesTab";
import { useAdminUnlock } from "@/hooks/useAdminUnlock";
import { getAdminSessionStatus } from "@/services/adminSession";
import type { ExpenseCategory } from "@/types/expense";

export default function ExpenseSettings() {
  const [activeTab, setActiveTab] = useState("items");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  const { promptForUnlock, pinDialogProps } = useAdminUnlock();

  function fetchCategories() {
    fetch("/api/expense-categories?all=true")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch((err) => console.error("Failed to fetch categories:", err));
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    getAdminSessionStatus().then((level) => setUnlocked(level === "admin"));
  }, []);

  async function handleUnlock() {
    if (await promptForUnlock("admin")) setUnlocked(true);
  }

  if (unlocked === null) {
    return <PageLoader />;
  }

  if (!unlocked) {
    return (
      <PageContainer className="min-h-[70vh] items-center justify-center gap-4 text-center">
        <LockedCard
          message="Enter the PIN to manage items & categories."
          onUnlock={handleUnlock}
        />
        <PinPromptDialog {...pinDialogProps} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="gap-5">
      <PageHeader
        eyebrow="Ship's stores"
        title="Settings"
        leading={
          <Link
            href="/expense"
            aria-label="Back to Expenses"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-card transition-colors hover:bg-accent-soft hover:text-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        items={[
          { value: "items", label: "Items" },
          { value: "categories", label: "Categories" },
        ]}
      >
        <TabsContent value="items" className="pt-4">
          <ManageItemsTab categories={categories} />
        </TabsContent>
        <TabsContent value="categories" className="pt-4">
          <ManageCategoriesTab categories={categories} onChanged={fetchCategories} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Tabs, { TabsContent } from "@/components/ui/Tabs";
import PageContainer from "@/components/ui/PageContainer";
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
    getAdminSessionStatus().then(setUnlocked);
  }, []);

  async function handleUnlock() {
    if (await promptForUnlock()) setUnlocked(true);
  }

  if (unlocked === null) {
    return <PageLoader />;
  }

  if (!unlocked) {
    return (
      <PageContainer className="min-h-[70vh] items-center justify-center gap-4 text-center">
        <Card className="flex flex-col items-center gap-3 p-6">
          <Lock className="h-5 w-5 text-muted" />
          <p className="text-sm text-muted">Enter the PIN to manage items &amp; categories.</p>
          <Button variant="outline" onClick={handleUnlock}>
            Unlock
          </Button>
        </Card>
        <PinPromptDialog {...pinDialogProps} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/expense"
          aria-label="Back to Expenses"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-2xl font-semibold text-foreground">Settings</h1>
      </div>

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

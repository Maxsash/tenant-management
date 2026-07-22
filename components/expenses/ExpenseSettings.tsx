"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Tabs, { TabsContent } from "@/components/ui/Tabs";
import PageContainer from "@/components/ui/PageContainer";
import ManageItemsTab from "./ManageItemsTab";
import ManageCategoriesTab from "./ManageCategoriesTab";
import type { ExpenseCategory } from "@/types/expense";
import { isAdminActionsEnabled } from "@/lib/config";

const ENABLE_ADMIN_ACTIONS = isAdminActionsEnabled();

export default function ExpenseSettings() {
  const [activeTab, setActiveTab] = useState("items");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  function fetchCategories() {
    fetch("/api/expense-categories?all=true")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch((err) => console.error("Failed to fetch categories:", err));
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  if (!ENABLE_ADMIN_ACTIONS) {
    return (
      <PageContainer>
        <p className="text-muted">This page is not available.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="lg" className="gap-5">
      <div className="flex items-center gap-2">
        <Link
          href="/expense"
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Box, Container, IconButton, Tab, Tabs, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import type { ExpenseCategory } from "@/types/expense";
import ManageItemsTab from "./ManageItemsTab";
import ManageCategoriesTab from "./ManageCategoriesTab";

import styles from "@/styles/manage-items.module.css";

const ENABLE_ADMIN_ACTIONS =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS === "true";

export default function ExpenseSettings() {
  const [activeTab, setActiveTab] = useState(0);
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
      <Container maxWidth="sm" className={styles.container}>
        <Typography>This page is not available.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" className={styles.container}>
      <Box className={styles.header}>
        <Link href="/expense">
          <IconButton>
            <ArrowBackIcon />
          </IconButton>
        </Link>

        <Typography variant="h5" className={styles.title}>
          Settings
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="fullWidth"
        className={styles.tabs}
      >
        <Tab label="Items" />
        <Tab label="Categories" />
      </Tabs>

      <Box className={styles.tabPanel}>
        {activeTab === 0 && <ManageItemsTab categories={categories} />}
        {activeTab === 1 && (
          <ManageCategoriesTab
            categories={categories}
            onChanged={fetchCategories}
          />
        )}
      </Box>
    </Container>
  );
}

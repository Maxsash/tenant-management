import React from "react";

import {
  Container,
  Typography,
  Grid,
  CircularProgress,
  TextField,
  Box,
  Button,
} from "@mui/material";

import styles from "@/styles/dashboard.module.css";

import TenantCard from "@/components/tenants/TenantCard";
import SummaryCard from "@/components/tenants/SummaryCard";

import { sendBroadcast } from "@/services/broadcast";
import { sendMonthlyGreeting } from "@/services/monthly-greeting";

type BroadcastResult = {
  id?: string;
  name?: string;
  phone?: string;
  status?: string;
  error?: string;
};

export default function Dashboard({
  data,
  month,
  onMonthChange,
  loading,
  onTenantClick,
}: any) {
  const paid =
    data?.tenants.filter(
      (t: any) => t.paid
    ) ?? [];

  const unpaid =
    data?.tenants.filter(
      (t: any) => !t.paid
    ) ?? [];

  const unpaidRef =
    React.useRef<HTMLDivElement>(null);

  const paidRef =
    React.useRef<HTMLDivElement>(null);

  const ENABLE_ADMIN_ACTIONS =
    process.env
      .NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS ===
    "true";

  function scrollToSection(
    section: "paid" | "unpaid"
  ) {
    if (section === "paid") {
      paidRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    } else {
      unpaidRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }

  async function handleBroadcast() {
    try {
      const result = await sendBroadcast(month);
      
      const total = (result.sent || 0) + (result.failed || 0);
      
      if (result.failed > 0) {
        const failedResults =
          result.failedResults ??
          result.results?.filter(
            (item: BroadcastResult) => item.status === "failed"
          ) ??
          [];
        const firstFailure = failedResults[0];
        const failureSummary = firstFailure
          ? `\nFirst failure: ${firstFailure.name || firstFailure.id || firstFailure.phone}: ${firstFailure.error || "Unknown error"}`
          : "";

        console.group("Broadcast failures");
        console.error("Broadcast response", result);
        console.table(failedResults);
        console.groupEnd();

        alert(
          `Total tenants: ${total}\n` +
          `✅ Successfully sent: ${result.sent}\n` +
          `❌ Failed: ${result.failed}` +
          failureSummary +
          `\n\n` +
          `Check console for details.`
        );
      } else {
        alert(`✅ Successfully sent reminder to ${total} tenant(s)!`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleMonthlyGreeting() {
    try {
      const result =
        await sendMonthlyGreeting(month);

      alert(
        `Monthly greetings sent to ${result.totalRecipients} tenants`
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleMarkPaid(
    tenant: any
  ) {
    const today = new Date()
      .toISOString()
      .slice(0, 10);

    await fetch("/api/mark-paid", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        month,
        paid_on: today,
      }),
      headers: {
        "Content-Type":
          "application/json",
      },
    });

    window.location.reload();
  }

  return (
    <Container
      maxWidth="sm"
      className={styles.container}
    >
      <Box className={styles.header}>
        <Typography
          variant="h4"
          className={styles.title}
        >
          🏠 Tenant Manager
        </Typography>

        <TextField
          type="month"
          value={month}
          onChange={(e) =>
            onMonthChange(e.target.value)
          }
          fullWidth
          className={styles.monthInput}
        />

        {ENABLE_ADMIN_ACTIONS && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={handleMonthlyGreeting}
              fullWidth
            >
              🌸 Send Monthly Greeting
            </Button>

            <Button
              variant="contained"
              color="warning"
              disabled={unpaid.length === 0}
              onClick={handleBroadcast}
              fullWidth
              className={styles.broadcastButton}
            >
              📢 Send Reminders (
              {unpaid.length})
            </Button>
          </Box>
        )}

      </Box>

      <Box className={styles.summaryGrid}>
        <SummaryCard
          title="Paid"
          count={paid.length}
          type="paid"
          onClick={() =>
            scrollToSection("paid")
          }
        />

        <SummaryCard
          title="Unpaid"
          count={unpaid.length}
          type="unpaid"
          onClick={() =>
            scrollToSection("unpaid")
          }
        />
      </Box>

      {loading ? (
        <Box className={styles.loader}>
          <CircularProgress size={50} />
        </Box>
      ) : (
        <>
          <Box
            ref={unpaidRef}
            className={styles.section}
          >
            <Typography
              className={`${styles.sectionTitle} ${styles.unpaidText}`}
            >
              ❌ Pending Rent
            </Typography>

            <Grid container spacing={2}>
              {unpaid.map((tenant: any) => (
                <Grid
                  size={{ xs: 12 }}
                  key={tenant.id}
                >
                  <TenantCard
                    tenant={tenant}
                    onClick={() =>
                      onTenantClick(
                        tenant
                      )
                    }
                    onMarkPaid={() =>
                      handleMarkPaid(
                        tenant
                      )
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box
            ref={paidRef}
            className={styles.section}
          >
            <Typography
              className={`${styles.sectionTitle} ${styles.paidText}`}
            >
              ✅ Paid Rent
            </Typography>

            <Grid container spacing={2}>
              {paid.map((tenant: any) => (
                <Grid
                  size={{ xs: 12 }}
                  key={tenant.id}
                >
                  <TenantCard
                    tenant={tenant}
                    onClick={() =>
                      onTenantClick(
                        tenant
                      )
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </>
      )}
    </Container>
  );
}

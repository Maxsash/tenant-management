'use client';

import { useState, useEffect } from "react";

import {
  Box,
  Typography,
  Divider,
  Chip,
  CircularProgress,
  Button,
  Alert,
} from "@mui/material";

import { formatFullDate } from "@/utils/date";
import { formatCurrency } from "@/utils/currency";
import { paymentHistory } from "@/services/paymentHistory";
import styles from "@/styles/payment-history.module.css";

interface PaymentHistoryTabProps {
  tenantId: string;
}

export default function PaymentHistoryTab({
  tenantId,
}: PaymentHistoryTabProps) {
  const [loading, setLoading] =
    useState(true);

  const [paymentData, setPaymentData] =
    useState<any>(null);

  const [error, setError] = useState<
    string | null
  >(null);

  const [showAllMonths, setShowAllMonths] =
    useState(false);

  useEffect(() => {
    if (tenantId) {
      loadPaymentHistory();
    }
  }, [tenantId]);

  const loadPaymentHistory = async () => {
    try {
      setLoading(true);

      setError(null);

      const data =
        await paymentHistory.getTenantPaymentHistory(
          tenantId
        );

      setPaymentData(data);
    } catch (err) {
      console.error(
        "Error loading payment history:",
        err
      );

      setError(
        "Unable to load payment history. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box className={styles.loadingContainer}>
        <CircularProgress size={40} />

        <Typography className={styles.loadingText}>
          Loading payment history...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={styles.errorContainer}>
        <Typography
          color="error"
          className={styles.errorText}
        >
          {error}
        </Typography>

        <Button
          onClick={loadPaymentHistory}
          variant="outlined"
          size="small"
        >
          Retry
        </Button>
      </Box>
    );
  }

  if (
    !paymentData ||
    paymentData.monthlyBreakdown.length === 0
  ) {
    return (
      <Box className={styles.emptyState}>
        <Typography
          variant="body1"
          color="text.secondary"
          align="center"
        >
          No payment history available
        </Typography>
      </Box>
    );
  }

  const { summary, monthlyBreakdown } =
    paymentData;

  const visibleMonths = showAllMonths
    ? monthlyBreakdown
    : monthlyBreakdown.slice(0, 6);

  const onTimePercentage =
    summary.totalExpected > 0
      ? Math.round(
          (summary.onTimeCount /
            summary.totalExpected) *
            100
        )
      : 0;

  return (
    <Box className={styles.container}>
      <Alert
        severity="info"
        className={styles.infoBanner}
      >
        <Typography variant="body2">
          📊 Showing payment records from
          December 2023 onwards
        </Typography>
      </Alert>

      {/* SUMMARY */}
      <Box className={styles.summaryGrid}>
        <Box className={styles.summaryCard}>
          <Typography
            className={styles.summaryTitle}
          >
            Total Paid
          </Typography>

          <Typography
            className={`${styles.summaryValue} ${styles.summarySuccess}`}
          >
            {formatCurrency(summary.totalPaid)}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            All successful payments
          </Typography>
        </Box>

        <Box className={styles.summaryCard}>
          <Typography
            className={styles.summaryTitle}
          >
            Pending Amount
          </Typography>

          <Typography
            className={`${styles.summaryValue} ${styles.summaryWarning}`}
          >
            {formatCurrency(summary.totalPending)}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            Outstanding balance
          </Typography>
        </Box>

        <Box className={styles.summaryCard}>
          <Typography
            className={styles.summaryTitle}
          >
            On-Time Rate
          </Typography>

          <Typography
            className={`${styles.summaryValue} ${styles.summaryPrimary}`}
          >
            {onTimePercentage}%
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            {
              summary.onTimeCount
            } on-time •{" "}
            {
              summary.latePaymentCount
            } late
          </Typography>
        </Box>
      </Box>

      {/* MONTHLY HISTORY */}
      <Typography
        variant="h6"
        className={styles.sectionTitle}
      >
        Monthly Payment History
      </Typography>

      <Divider className={styles.divider} />

      <Box className={styles.monthlyList}>
        {visibleMonths.map(
          (month: any) => {
            const isPaid =
              month.status === "paid";

            const isLate =
              month.status === "late";

            const isPending =
              month.status ===
              "pending";

            return (
              <Box
                key={month.month}
                className={
                  styles.monthlyItem
                }
              >
                <Box
                  className={
                    styles.monthlyHeader
                  }
                >
                  <Typography
                    className={
                      styles.monthName
                    }
                  >
                    {formatMonthYear(
                      month.month
                    )}
                  </Typography>

                  <Chip
                    label={
                      isPaid
                        ? "Paid"
                        : isLate
                        ? "Late"
                        : "Pending"
                    }
                    color={
                      isPaid
                        ? "success"
                        : isLate
                        ? "warning"
                        : "error"
                    }
                    size="small"
                    className={
                      styles.monthlyStatus
                    }
                  />
                </Box>

                <Typography
                  className={
                    styles.monthlyAmount
                  }
                >
                  {formatCurrency(
                    month.amount
                  )}
                </Typography>

                {(isPaid ||
                  isLate) &&
                  month.paid_on && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className={
                        styles.paidDate
                      }
                    >
                      Paid on:{" "}
                      {formatFullDate(
                        month.paid_on
                      )}

                      {isLate &&
                        " (Late payment)"}
                    </Typography>
                  )}

                {isPending && (
                  <Typography
                    variant="caption"
                    color="warning.main"
                    className={
                      styles.paidDate
                    }
                  >
                    Payment pending
                  </Typography>
                )}
              </Box>
            );
          }
        )}
      </Box>

      {monthlyBreakdown.length > 6 && (
        <Box
          className={
            styles.showMoreContainer
          }
        >
          <Button
            onClick={() =>
              setShowAllMonths(
                !showAllMonths
              )
            }
            variant="text"
            size="small"
            className={
              styles.showMoreButton
            }
          >
            {showAllMonths
              ? "Show Less ↑"
              : `Show More (${
                  monthlyBreakdown.length -
                  6
                } more months) ↓`}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function formatMonthYear(
  monthStr: string
): string {
  const [year, month] =
    monthStr.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  return date.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );
}
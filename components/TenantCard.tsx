import {
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Box,
} from "@mui/material";

import styles from "@/styles/dashboard.module.css";

import { formatDate } from "@/utils/date";

type Props = {
  tenant: any;
  onClick: () => void;
  onMarkPaid?: () => void;
};

export default function TenantCard({
  tenant,
  onClick,
  onMarkPaid,
}: Props) {
  const isPaid = tenant.paid;

    const ENABLE_ADMIN_ACTIONS =
    process.env
        .NEXT_PUBLIC_ENABLE_ADMIN_ACTIONS ===
    "true";

  return (
    <Card
      onClick={onClick}
      className={`${styles.tenantCard} ${
        isPaid
          ? styles.paidCard
          : styles.unpaidCard
      }`}
    >
      <CardContent
        className={styles.cardContent}
      >
        <Box className={styles.cardTop}>
          <Box>
            <Typography
              className={styles.tenantName}
            >
              {tenant.name}
            </Typography>

            <Typography
              className={
                styles.propertyType
              }
            >
              {tenant.property_type}
            </Typography>
          </Box>

          <Typography
            className={`${styles.amount} ${
              isPaid
                ? styles.amountPaid
                : styles.amountUnpaid
            }`}
          >
            ₹{tenant.amount}
          </Typography>
        </Box>

        <Box className={styles.statusBox}>
          {isPaid ? (
            <Chip
              label={`✓ Paid on ${formatDate(
                tenant.paid_on
              )}`}
              className={styles.paidChip}
            />
          ) : (
            <>
              <Chip
                label="❌ Rent Pending"
                className={
                  styles.unpaidChip
                }
              />
            {ENABLE_ADMIN_ACTIONS && (
              <Button
                variant="contained"
                color="success"
                fullWidth
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkPaid?.();
                }}
                className={
                  styles.markPaidButton
                }
              >
                Mark as Paid
              </Button>
            )}
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
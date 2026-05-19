import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";

import {
  formatFullDate,
} from "@/utils/date";

import {
  formatCurrency,
} from "@/utils/currency";

import {
  formatIncrease,
} from "@/utils/tenant";

import styles from "@/styles/tenant-details.module.css";

export default function TenantDetails({
  tenant,
  onBack,
}: any) {
  const paidDate = tenant.paid_on
    ? formatFullDate(
        tenant.paid_on
      )
    : null;

  const tenantSince =
    tenant.tenant_since
      ? formatFullDate(
          tenant.tenant_since
        )
      : "—";

  const securityDeposit =
    formatCurrency(
      tenant.security_deposit
    );

  const rentAmount =
    formatCurrency(
      tenant.amount
    );

  const increaseValue =
    formatIncrease(
      tenant.increase_type,
      tenant.increase_by
    );

  return (
    <Box className={styles.page}>
      <Button
        variant="text"
        onClick={onBack}
        className={
          styles.backButton
        }
      >
        ← Back
      </Button>

      <Card className={styles.card}>
        <Box
          className={`${styles.hero} ${
            tenant.paid
              ? styles.heroPaid
              : styles.heroPending
          }`}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
            }}
          >
            {tenant.name}
          </Typography>

          <Typography color="text.secondary">
            {
              tenant.property_type
            }
          </Typography>

          <Typography
            variant="h3"
            sx={{
              mt: 2,
              fontWeight: 700,
            }}
          >
            {rentAmount}
          </Typography>

          <Box
            className={
              styles.statusBox
            }
          >
            {tenant.paid ? (
              <Chip
                color="success"
                label={`Paid on ${paidDate}`}
                className={
                  styles.statusChip
                }
              />
            ) : (
              <Chip
                color="warning"
                label="Payment Pending"
                className={
                  styles.statusChip
                }
              />
            )}
          </Box>
        </Box>

        <CardContent
          className={
            styles.content
          }
        >
          <DetailRow
            label="Phone"
            value={tenant.phone}
          />

          <DetailRow
            label="Tenant Since"
            value={tenantSince}
          />

          <DetailRow
            label="Security Deposit"
            value={
              securityDeposit
            }
          />

          <DetailRow
            label="Bank"
            value={tenant.bank}
          />

          <DetailRow
            label="Rent Increase Month"
            value={
              tenant.increase_month ||
              "—"
            }
          />

          <DetailRow
            label="Increase"
            value={
              increaseValue
            }
          />
        </CardContent>
      </Card>
    </Box>
  );
}

function DetailRow({
  label,
  value,
}: any) {
  return (
    <>
      <Box
        className={
          styles.detailRow
        }
      >
        <Typography
          color="text.secondary"
          className={
            styles.detailLabel
          }
        >
          {label}
        </Typography>

        <Typography
          className={
            styles.detailValue
          }
        >
          {value || "—"}
        </Typography>
      </Box>

      <Divider />
    </>
  );
}
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";

export default function TenantDetails({
  tenant,
  onBack,
}: any) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#f5f5f5",
        p: 2,
      }}
    >
      <Button
        variant="text"
        onClick={onBack}
        sx={{ mb: 2 }}
      >
        ← Back
      </Button>

      <Card
        sx={{
          borderRadius: 5,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 3,
            background:
              tenant.paid
                ? "#e8f5e9"
                : "#fff3e0",
          }}
        >
          <Typography
            variant="h5"
            sx={{ fontWeight: 700 }}
          >
            {tenant.name}
          </Typography>

          <Typography color="text.secondary">
            {tenant.property_type}
          </Typography>

          <Typography
            variant="h4"
            sx={{ mt: 2, fontWeight: 700 }}
          >
            ₹
            {Number(
              tenant.amount
            ).toLocaleString("en-IN")}
          </Typography>

          <Box sx={{ mt: 2 }}>
            {tenant.paid ? (
              <Chip
                color="success"
                label={`Paid ${tenant.paid_on}`}
              />
            ) : (
              <Chip
                color="warning"
                label="Payment Pending"
              />
            )}
          </Box>
        </Box>

        <CardContent>
          <DetailRow
            label="Phone"
            value={tenant.phone}
          />

          <DetailRow
            label="Tenant Since"
            value={tenant.tenant_since}
          />

          <DetailRow
            label="Security Deposit"
            value={`₹${Number(
              tenant.security_deposit || 0
            ).toLocaleString("en-IN")}`}
          />

          <DetailRow
            label="Bank"
            value={tenant.bank}
          />

          <DetailRow
            label="Increase Month"
            value={tenant.increase_month}
          />

          <DetailRow
            label="Increase Type"
            value={tenant.increase_type}
          />

          <DetailRow
            label="Increase By"
            value={tenant.increase_by}
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
        sx={{
          py: 2,
          display: "flex",
          justifyContent:
            "space-between",
          gap: 2,
        }}
      >
        <Typography
          color="text.secondary"
        >
          {label}
        </Typography>

        <Typography
          sx={{
            fontWeight: 600,
            textAlign: "right",
          }}
        >
          {value || "—"}
        </Typography>
      </Box>

      <Divider />
    </>
  );
}
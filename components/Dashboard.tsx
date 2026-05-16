import {
  Container, Typography, Grid, Card, CardContent,
  Chip, Button, CircularProgress, TextField, Box, Divider
} from "@mui/material";
import styles from "@/styles/dashboard.module.css";

export default function Dashboard({ data, month, onMonthChange, loading }: any) {
  const paid = data?.tenants.filter((t: any) => t.paid) ?? [];
  const unpaid = data?.tenants.filter((t: any) => !t.paid) ?? [];

  async function handleBroadcast() {
  try {
    const res = await fetch("/api/broadcast", {
      method: "POST",
      body: JSON.stringify({ month }),
      headers: {
        "Content-Type": "application/json",
        "x-api-secret":
          process.env.NEXT_PUBLIC_API_SECRET!,
      },
    });

    const data = await res.json();

    console.log("BROADCAST RESPONSE:", data);

    if (!res.ok) {
      alert(`Failed: ${data.error}`);
      return;
    }

    alert(
      `Reminders sent to ${data.total} tenants`
    );
  } catch (err) {
    console.error(err);
    alert("Broadcast failed");
  }
}

  async function handleMarkPaid(tenant: any) {
    const today = new Date().toISOString().slice(0, 10);
    await fetch("/api/mark-paid", {
      method: "POST",
      body: JSON.stringify({ tenant_id: tenant.id, month, paid_on: today }),
      headers: { "Content-Type": "application/json" },
    });
    window.location.reload();
  }

  return (
    <Container maxWidth="lg" className={styles.container}>
      <Box className={styles.header}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
            🏠 Rent Manager
        </Typography>
        <Box className={styles.controls}>
          <TextField
            type="month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
            size="small"
          />
          <Button
            variant="contained"
            color="warning"
            disabled={unpaid.length === 0}
            onClick={handleBroadcast}
          >
            Send Reminders ({unpaid.length})
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box className={styles.center}><CircularProgress /></Box>
      ) : (
        <>
          <Box className={styles.summary}>
            <Typography color="success.main">✓ Paid: {paid.length}</Typography>
            <Typography color="error.main">✗ Unpaid: {unpaid.length}</Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            {data?.tenants.map((t: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                <Card className={`${styles.card} ${t.paid ? styles.paid : styles.unpaid}`}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{t.property_type}</Typography>
                    <Typography variant="h6" sx={{ mt: 1 }}>₹{t.amount}</Typography>
                    {t.paid ? (
                      <Chip label={`Paid ${t.paid_on}`} color="success" size="small" sx={{ mt: 1 }} />
                    ) : (
                      <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                        <Chip label="Unpaid" color="error" size="small" />
                        <Button size="small" variant="outlined" onClick={() => handleMarkPaid(t)}>
                          Mark Paid
                        </Button>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Container>
  );
}
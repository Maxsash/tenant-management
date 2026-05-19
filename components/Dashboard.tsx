import {
  Container, Typography, Grid, Card, CardContent,
  Chip, Button, CircularProgress, TextField, Box, Divider
} from "@mui/material";
import styles from "@/styles/dashboard.module.css";

export default function Dashboard({
  data,
  month,
  onMonthChange,
  loading,
  onTenantClick,
}: any) {
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
    <Container
      maxWidth="sm"
      sx={{
        py: 2,
        px: 1.5,
        background: "#f4f6f8",
        minHeight: "100vh",
      }}
    >
      {/* HEADER */}
      <Box
        sx={{
          mb: 3,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            fontSize: 32,
            textAlign: "center",
          }}
        >
          🏠 Rent Manager
        </Typography>

        <TextField
          type="month"
          value={month}
          onChange={(e) =>
            onMonthChange(e.target.value)
          }
          fullWidth
          size="medium"
          sx={{
            background: "white",
            borderRadius: 3,
          }}
        />

        <Button
          variant="contained"
          color="warning"
          disabled={unpaid.length === 0}
          onClick={handleBroadcast}
          fullWidth
          sx={{
            py: 1.8,
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 4,
            textTransform: "none",
          }}
        >
          📢 Send Reminders (
          {unpaid.length})
        </Button>
      </Box>

      {/* SUMMARY */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
          mb: 3,
        }}
      >
        <Card
          sx={{
            borderRadius: 4,
            background: "#e8f5e9",
          }}
        >
          <CardContent>
            <Typography
              sx={{
                fontSize: 14,
                color: "#2e7d32",
                fontWeight: 600,
              }}
            >
              Paid
            </Typography>

            <Typography
              sx={{
                fontSize: 34,
                fontWeight: 800,
                color: "#1b5e20",
              }}
            >
              {paid.length}
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            borderRadius: 4,
            background: "#ffebee",
          }}
        >
          <CardContent>
            <Typography
              sx={{
                fontSize: 14,
                color: "#c62828",
                fontWeight: 600,
              }}
            >
              Unpaid
            </Typography>

            <Typography
              sx={{
                fontSize: 34,
                fontWeight: 800,
                color: "#b71c1c",
              }}
            >
              {unpaid.length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: 10,
          }}
        >
          <CircularProgress size={50} />
        </Box>
      ) : (
        <Grid container spacing={2}>
          {data?.tenants.map((t: any) => (
            <Grid
              size={{ xs: 12 }}
              key={t.id}
            >
              <Card
                onClick={() =>
                  onTenantClick(t)
                }
                sx={{
                  borderRadius: 5,
                  cursor: "pointer",
                  overflow: "hidden",
                  border: t.paid
                    ? "3px solid #66bb6a"
                    : "3px solid #ef5350",
                  background: t.paid
                    ? "#ffffff"
                    : "#fff8f8",
                  boxShadow:
                    "0 4px 12px rgba(0,0,0,0.08)",
                }}
              >
                <CardContent
                  sx={{
                    p: 2.5,
                  }}
                >
                  {/* TOP ROW */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontSize: 22,
                          fontWeight: 800,
                          lineHeight: 1.2,
                        }}
                      >
                        {t.name}
                      </Typography>

                      <Typography
                        sx={{
                          mt: 0.5,
                          color: "#666",
                          fontSize: 15,
                        }}
                      >
                        {t.property_type}
                      </Typography>
                    </Box>

                    <Typography
                      sx={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: t.paid
                          ? "#2e7d32"
                          : "#d32f2f",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ₹{t.amount}
                    </Typography>
                  </Box>

                  {/* STATUS */}
                  <Box sx={{ mt: 2 }}>
                    {t.paid ? (
                      <Chip
                        label={`✓ Paid on ${new Date(
                          t.paid_on
                        ).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                          }
                        )}`}
                        sx={{
                          background:
                            "#43a047",
                          color: "white",
                          fontWeight: 700,
                          fontSize: 15,
                          px: 1,
                          py: 2.2,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection:
                            "column",
                          gap: 1.5,
                        }}
                      >
                        <Chip
                          label="❌ Rent Pending"
                          sx={{
                            background:
                              "#e53935",
                            color: "white",
                            fontWeight: 700,
                            fontSize: 15,
                            py: 2.2,
                          }}
                        />

                        <Button
                          variant="contained"
                          color="success"
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPaid(t);
                          }}
                          sx={{
                            py: 1.4,
                            borderRadius: 3,
                            fontWeight: 700,
                            fontSize: 16,
                            textTransform:
                              "none",
                          }}
                        >
                          Mark as Paid
                        </Button>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
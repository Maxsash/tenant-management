import Link from "next/link";
import {
  Container,
  Typography,
  Box,
  Paper,
} from "@mui/material";

import ApartmentIcon from "@mui/icons-material/Apartment";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PeopleIcon from "@mui/icons-material/People";
import HomeIcon from "@mui/icons-material/Home";
import DescriptionIcon from "@mui/icons-material/Description";

import styles from "@/styles/dashboard.module.css";

const apps = [
  {
    title: "Tenants",
    href: "/tenant",
    icon: ApartmentIcon,
    color: "#1976d2",
  },
  {
    title: "Expenses",
    href: "/expense",
    icon: ReceiptLongIcon,
    color: "#2e7d32",
  },
  {
    title: "Accounts",
    href: "/accounts",
    icon: AccountBalanceWalletIcon,
    color: "#ef6c00",
  },
  {
    title: "Family",
    href: "/family",
    icon: PeopleIcon,
    color: "#8e24aa",
  },
  {
    title: "Properties",
    href: "/property",
    icon: HomeIcon,
    color: "#00897b",
  },
  {
    title: "Documents",
    href: "/documents",
    icon: DescriptionIcon,
    color: "#5d4037",
  },
];

export default function Hub() {
  return (
    <Container maxWidth="sm" className={styles.container}>
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          🏠 Shrivastava Hub
        </Typography>

        <Typography color="text.secondary">
          Everything in one place
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 2,
        }}
      >
        {apps.map((app) => {
          const Icon = app.icon;

          return (
            <Link
              key={app.title}
              href={app.href}
              style={{
                textDecoration: "none",
              }}
            >
              <Paper
                elevation={3}
                sx={{
                  height: 150,
                  borderRadius: 4,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: ".2s",
                  "&:hover": {
                    transform: "translateY(-3px)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 3,
                    background: app.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2,
                  }}
                >
                  <Icon
                    sx={{
                      color: "white",
                      fontSize: 40,
                    }}
                  />
                </Box>

                <Typography
                  sx={{ fontWeight: 600 }}
                  align="center"
                >
                  {app.title}
                </Typography>
              </Paper>
            </Link>
          );
        })}
      </Box>
    </Container>
  );
}
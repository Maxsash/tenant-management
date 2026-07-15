import {
  Card,
  CardContent,
  Typography,
} from "@mui/material";

import styles from "@/styles/dashboard.module.css";

type Props = {
  title: string;
  count: number;
  type: "paid" | "unpaid";
  onClick: () => void;
};

export default function SummaryCard({
  title,
  count,
  type,
  onClick,
}: Props) {
  return (
    <Card
      onClick={onClick}
      className={`${styles.summaryCard} ${
        type === "paid"
          ? styles.summaryPaid
          : styles.summaryUnpaid
      }`}
    >
      <CardContent>
        <Typography
          className={styles.summaryTitle}
        >
          {title}
        </Typography>

        <Typography
          className={styles.summaryCount}
        >
          {count}
        </Typography>
      </CardContent>
    </Card>
  );
}
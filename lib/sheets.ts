import { google } from "googleapis";
import { getRentMonth } from "@/lib/rent";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function getSheetRows<T>(sheetName: string): Promise<T[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z`,
  });

  const [headers, ...rows] = res.data.values ?? [];

  const mapped = rows.map((row) =>
    Object.fromEntries(
      headers.map((h: string, i: number) => [h, row[i] ?? ""])
    ) as any
  );

  // For payments, provide explicit `payment_month` and computed `rent_month` fields.
  if (sheetName === "payments") {
    return mapped.map((r: any) => {
      const rawMonth = String(r.month ?? r.payment_month ?? r.paid_on ?? "").slice(0, 7);
      const payment_month = rawMonth || "";
      const rent_month = payment_month ? getRentMonth(payment_month) : "";

      return {
        ...r,
        payment_month,
        rent_month,
      } as T;
    });
  }

  return mapped as T[];
}

export async function appendSheetRow(sheetName: string, values: string[]) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

export async function updateSheetRow(
  sheetName: string,
  rowIndex: number, // 2-based (1=header, 2=first data row)
  values: string[]
) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}
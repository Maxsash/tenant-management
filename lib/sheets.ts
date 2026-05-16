import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function getSheetRows(sheetName: string) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  const [headers, ...rows] = res.data.values ?? [];
  return rows.map((row) =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] ?? ""]))
  );
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
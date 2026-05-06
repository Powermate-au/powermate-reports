// Shared Google Sheets helpers — used by every API route that reads/writes
// the project's Sheet. Replaces the auth + ensure-tab + read/rewrite
// boilerplate previously duplicated across 4 routes.

import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export function sheetId() {
  return SHEET_ID;
}

export async function getSheetsClient({ readonly = false } = {}) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      readonly
        ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
        : 'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
  return google.sheets({ version: 'v4', auth });
}

// Create the tab if it doesn't exist. Optionally seed the header row.
export async function ensureTab(sheets, tab, headers = null) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const has = meta.data.sheets.some((s) => s.properties.title === tab);
  if (has) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
  });
  if (headers && headers.length > 0) {
    const lastCol = String.fromCharCode(64 + headers.length); // A=1, B=2…
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tab}!A1:${lastCol}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] },
    });
  }
}

// Returns rows as a 2D array, header row stripped, blanks at column 0 filtered out.
export async function readTabRows(sheets, tab) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: tab,
  });
  return (res.data.values || []).slice(1).filter((r) => r[0]);
}

// Clears the tab and rewrites it with headers + the given rows.
export async function rewriteTab(sheets, tab, headers, rows) {
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: tab });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers, ...rows] },
  });
}

export async function appendRow(sheets, tab, row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: tab,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
}

import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'Daily Reports';

    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: tab,
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json({ headers: [], rows: [] });
    }

    const headers = rows[0];
    const data = rows.slice(1);

    return NextResponse.json({ headers, rows: data });
  } catch (error) {
    console.error('Sheets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tab = body.form_type === 'weekly' ? 'Weekly Wrap' : 'Daily Reports';

    const sheets = await getGoogleSheetsClient();

    // Get existing headers or create them
    let headers;
    try {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${tab}!1:1`,
      });
      headers = existing.data.values?.[0];
    } catch {
      headers = null;
    }

    if (!headers || headers.length === 0) {
      headers = Object.keys(body);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: tab,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    }

    const row = headers.map(h => body[h] !== undefined ? body[h] : '');
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: tab,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Sheets API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
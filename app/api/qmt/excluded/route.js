import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = 'QMT Excluded';
const HEADERS = ['job_uuid', 'reason', 'excluded_at'];

async function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const has = meta.data.sheets.some((s) => s.properties.title === TAB);
  if (has) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:C1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });
}

async function readAll(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: TAB,
  });
  return (res.data.values || []).slice(1).filter((r) => r[0]);
}

export async function GET() {
  try {
    const sheets = await getSheets();
    await ensureTab(sheets);
    const rows = await readAll(sheets);
    return NextResponse.json({
      excluded: rows.map(([uuid, reason, excludedAt]) => ({ uuid, reason: reason || '', excludedAt: excludedAt || '' })),
    });
  } catch (e) {
    console.error('Excluded GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { uuid, reason } = await request.json();
    if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 });
    const sheets = await getSheets();
    await ensureTab(sheets);
    const rows = await readAll(sheets);
    if (rows.some((r) => r[0] === uuid)) return NextResponse.json({ status: 'already_excluded' });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: TAB,
      valueInputOption: 'RAW',
      requestBody: { values: [[uuid, reason || '', new Date().toISOString()]] },
    });
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Excluded POST error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uuid = searchParams.get('uuid');
    if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 });
    const sheets = await getSheets();
    await ensureTab(sheets);
    const rows = await readAll(sheets);
    const kept = rows.filter((r) => r[0] !== uuid);
    await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: TAB });
    const values = [HEADERS, ...kept];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Excluded DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

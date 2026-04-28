import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = 'QMT Reasons';
const HEADERS = ['job_uuid', 'reason', 'reason_type', 'assigned_at'];

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
    range: `${TAB}!A1:D1`,
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

async function rewrite(sheets, rows) {
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: TAB });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS, ...rows] },
  });
}

export async function GET() {
  try {
    const sheets = await getSheets();
    await ensureTab(sheets);
    const rows = await readAll(sheets);
    return NextResponse.json({
      reasons: rows.map(([uuid, reason, reasonType, assignedAt]) => ({
        uuid,
        reason: reason || '',
        reasonType: reasonType || '',
        assignedAt: assignedAt || '',
      })),
    });
  } catch (e) {
    console.error('Reasons GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Upsert: replace existing row for this uuid, or append if new.
export async function POST(request) {
  try {
    const { uuid, reason, reasonType } = await request.json();
    if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 });
    if (!reason) return NextResponse.json({ error: 'reason required' }, { status: 400 });
    if (reasonType !== 'variance' && reasonType !== 'loss') {
      return NextResponse.json({ error: 'reasonType must be variance|loss' }, { status: 400 });
    }
    const sheets = await getSheets();
    await ensureTab(sheets);
    const rows = await readAll(sheets);
    const filtered = rows.filter((r) => r[0] !== uuid);
    filtered.push([uuid, reason, reasonType, new Date().toISOString()]);
    await rewrite(sheets, filtered);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Reasons POST error:', e);
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
    await rewrite(sheets, kept);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Reasons DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

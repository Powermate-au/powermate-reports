import { NextResponse } from 'next/server';
import { getSheetsClient, ensureTab, readTabRows, rewriteTab, appendRow } from '@/lib/sheets-tab';

const TAB = 'QMT Excluded';
const HEADERS = ['job_uuid', 'reason', 'excluded_at'];

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    return NextResponse.json({
      excluded: rows.map(([uuid, reason, excludedAt]) => ({
        uuid,
        reason: reason || '',
        excludedAt: excludedAt || '',
      })),
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
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    if (rows.some((r) => r[0] === uuid)) {
      return NextResponse.json({ status: 'already_excluded' });
    }
    await appendRow(sheets, TAB, [uuid, reason || '', new Date().toISOString()]);
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
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    const kept = rows.filter((r) => r[0] !== uuid);
    await rewriteTab(sheets, TAB, HEADERS, kept);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Excluded DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

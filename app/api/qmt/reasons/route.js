import { NextResponse } from 'next/server';
import { getSheetsClient, ensureTab, readTabRows, rewriteTab } from '@/lib/sheets-tab';

const TAB = 'QMT Reasons';
const HEADERS = ['job_uuid', 'reason', 'reason_type', 'assigned_at'];

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
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
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    const filtered = rows.filter((r) => r[0] !== uuid);
    filtered.push([uuid, reason, reasonType, new Date().toISOString()]);
    await rewriteTab(sheets, TAB, HEADERS, filtered);
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
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    const kept = rows.filter((r) => r[0] !== uuid);
    await rewriteTab(sheets, TAB, HEADERS, kept);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Reasons DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

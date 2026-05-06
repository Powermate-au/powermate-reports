import { NextResponse } from 'next/server';
import { getSheetsClient, ensureTab, readTabRows, rewriteTab } from '@/lib/sheets-tab';

const TAB = 'Config';
const HEADERS = ['key', 'value', 'label'];

// Rows are stored as: key | value | label
//   job_type | solar    | Solar
//   variance_cause | Poor Estimating | (label unused)
function parseRows(rows) {
  const jobTypesByTag = new Map();
  const varianceCauses = [];
  const lossReasons = [];
  const targets = {};
  rows.forEach(([key, value, label]) => {
    if (!key) return;
    if (key === 'job_type' && value) {
      const existing = jobTypesByTag.get(value) || {};
      jobTypesByTag.set(value, { ...existing, tag: value, label: label || value });
    } else if ((key === 'variance_cause' || key === 'root_cause') && value) {
      // root_cause is the legacy key — read both, write the new one.
      varianceCauses.push(value);
    } else if (key === 'loss_reason' && value) {
      lossReasons.push(value);
    } else if (key === 'target_inc_labour' && value) {
      targets.incLabour = parseFloat(value);
    } else if (key === 'target_ex_labour' && value) {
      targets.exLabour = parseFloat(value);
    } else if (key === 'target_dollars_per_hour' && value) {
      targets.dollarsPerHour = parseFloat(value);
    } else if (key.startsWith('target_dph_') && value) {
      const tag = key.slice('target_dph_'.length);
      const existing = jobTypesByTag.get(tag) || { tag, label: tag };
      jobTypesByTag.set(tag, { ...existing, targetDollarsPerHour: parseFloat(value) });
    } else if (key.startsWith('target_inc_') && value) {
      const tag = key.slice('target_inc_'.length);
      const existing = jobTypesByTag.get(tag) || { tag, label: tag };
      jobTypesByTag.set(tag, { ...existing, targetInc: parseFloat(value) });
    } else if (key.startsWith('target_ex_') && value) {
      const tag = key.slice('target_ex_'.length);
      const existing = jobTypesByTag.get(tag) || { tag, label: tag };
      jobTypesByTag.set(tag, { ...existing, targetEx: parseFloat(value) });
    }
  });
  return {
    jobTypes: Array.from(jobTypesByTag.values()),
    varianceCauses,
    lossReasons,
    rootCauses: varianceCauses, // back-compat alias
    targets,
  };
}

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);
    const rows = await readTabRows(sheets, TAB);
    return NextResponse.json(parseRows(rows));
  } catch (e) {
    console.error('Config GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const jobTypes = Array.isArray(body.jobTypes) ? body.jobTypes : [];
    const varianceCauses = Array.isArray(body.varianceCauses)
      ? body.varianceCauses
      : Array.isArray(body.rootCauses)
      ? body.rootCauses
      : [];
    const lossReasons = Array.isArray(body.lossReasons) ? body.lossReasons : [];
    const targets = body.targets || {};

    const sheets = await getSheetsClient();
    await ensureTab(sheets, TAB, HEADERS);

    const rows = [];
    jobTypes.forEach((t) => {
      if (!t?.tag) return;
      rows.push(['job_type', t.tag, t.label || t.tag]);
      if (Number.isFinite(t.targetInc)) rows.push([`target_inc_${t.tag}`, String(t.targetInc), '']);
      if (Number.isFinite(t.targetEx)) rows.push([`target_ex_${t.tag}`, String(t.targetEx), '']);
      if (Number.isFinite(t.targetDollarsPerHour)) {
        rows.push([`target_dph_${t.tag}`, String(t.targetDollarsPerHour), '']);
      }
    });
    varianceCauses.forEach((c) => {
      if (c) rows.push(['variance_cause', c, '']);
    });
    lossReasons.forEach((c) => {
      if (c) rows.push(['loss_reason', c, '']);
    });
    if (Number.isFinite(targets.incLabour)) {
      rows.push(['target_inc_labour', String(targets.incLabour), 'Inc Labour margin target']);
    }
    if (Number.isFinite(targets.exLabour)) {
      rows.push(['target_ex_labour', String(targets.exLabour), 'Ex Labour margin target']);
    }
    if (Number.isFinite(targets.dollarsPerHour)) {
      rows.push(['target_dollars_per_hour', String(targets.dollarsPerHour), 'Profit per hour target']);
    }

    await rewriteTab(sheets, TAB, HEADERS, rows);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Config PUT error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

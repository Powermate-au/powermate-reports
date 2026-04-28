import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB = 'Config';

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
    requestBody: {
      requests: [{ addSheet: { properties: { title: TAB } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:C1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['key', 'value', 'label']] },
  });
}

// Rows are stored as: key | value | label
//   job_type | solar    | Solar
//   root_cause | Poor Estimating | (label unused)
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
    const sheets = await getSheets();
    await ensureTab(sheets);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: TAB,
    });
    const rows = (res.data.values || []).slice(1);
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

    const sheets = await getSheets();
    await ensureTab(sheets);

    const values = [['key', 'value', 'label']];
    jobTypes.forEach((t) => {
      if (!t?.tag) return;
      values.push(['job_type', t.tag, t.label || t.tag]);
      if (Number.isFinite(t.targetInc)) {
        values.push([`target_inc_${t.tag}`, String(t.targetInc), '']);
      }
      if (Number.isFinite(t.targetEx)) {
        values.push([`target_ex_${t.tag}`, String(t.targetEx), '']);
      }
      if (Number.isFinite(t.targetDollarsPerHour)) {
        values.push([`target_dph_${t.tag}`, String(t.targetDollarsPerHour), '']);
      }
    });
    varianceCauses.forEach((c) => {
      if (c) values.push(['variance_cause', c, '']);
    });
    lossReasons.forEach((c) => {
      if (c) values.push(['loss_reason', c, '']);
    });
    if (Number.isFinite(targets.incLabour)) {
      values.push(['target_inc_labour', String(targets.incLabour), 'Inc Labour margin target']);
    }
    if (Number.isFinite(targets.exLabour)) {
      values.push(['target_ex_labour', String(targets.exLabour), 'Ex Labour margin target']);
    }
    if (Number.isFinite(targets.dollarsPerHour)) {
      values.push(['target_dollars_per_hour', String(targets.dollarsPerHour), 'Profit per hour target']);
    }

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: TAB,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    console.error('Config PUT error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

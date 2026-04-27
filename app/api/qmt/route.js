import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { loadAll } from '@/lib/jobs-source';
import {
  processJobs,
  summariseByStatus,
  summariseByJobType,
  topLevelKpis,
} from '@/lib/qmt-calc';
import {
  DEFAULT_JOB_TYPES,
  DEFAULT_TARGET_INC_LABOUR,
  DEFAULT_TARGET_EX_LABOUR,
} from '@/lib/qmt-config';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function loadExcludedUuids() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'QMT Excluded',
    });
    return (res.data.values || []).slice(1).map((r) => r[0]).filter(Boolean);
  } catch {
    return [];
  }
}

async function loadConfig() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Config',
    });
    const rows = (res.data.values || []).slice(1);
    const typesByTag = new Map();
    rows.forEach(([k, v, label]) => {
      if (k === 'job_type' && v) {
        const cur = typesByTag.get(v) || {};
        typesByTag.set(v, { ...cur, tag: v, label: label || v });
      } else if (k && k.startsWith('target_inc_') && k !== 'target_inc_labour' && v) {
        const tag = k.slice('target_inc_'.length);
        const cur = typesByTag.get(tag) || { tag, label: tag };
        typesByTag.set(tag, { ...cur, targetInc: parseFloat(v) });
      } else if (k && k.startsWith('target_ex_') && k !== 'target_ex_labour' && v) {
        const tag = k.slice('target_ex_'.length);
        const cur = typesByTag.get(tag) || { tag, label: tag };
        typesByTag.set(tag, { ...cur, targetEx: parseFloat(v) });
      }
    });
    const types = Array.from(typesByTag.values());
    const targets = {
      incLabour: DEFAULT_TARGET_INC_LABOUR,
      exLabour: DEFAULT_TARGET_EX_LABOUR,
    };
    rows.forEach(([k, v]) => {
      if (k === 'target_inc_labour' && v) targets.incLabour = parseFloat(v);
      if (k === 'target_ex_labour' && v) targets.exLabour = parseFloat(v);
    });
    return {
      jobTypes: types.length > 0 ? types : DEFAULT_JOB_TYPES,
      targets,
    };
  } catch {
    return {
      jobTypes: DEFAULT_JOB_TYPES,
      targets: {
        incLabour: DEFAULT_TARGET_INC_LABOUR,
        exLabour: DEFAULT_TARGET_EX_LABOUR,
      },
    };
  }
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const all = searchParams.get('all') === '1';
    const testMode = searchParams.get('test') === '1';
    const fresh = searchParams.get('fresh') === '1';

    const from = parseDate(fromParam);
    const to = parseDate(toParam);

    const [
      { jobs, lineItems, contacts, companies, materials, activities, staff },
      config,
      excludedUuids,
    ] = await Promise.all([loadAll({ fresh }), loadConfig(), loadExcludedUuids()]);
    const { jobTypes, targets } = config;

    let filteredJobs = jobs;
    if (!all && (from || to)) {
      filteredJobs = jobs.filter((j) => {
        const dStr = j.date || j.quote_date || '';
        if (!dStr || dStr.startsWith('0000')) return false;
        const d = new Date(dStr.replace(' ', 'T'));
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });
    }
    if (testMode) {
      filteredJobs = filteredJobs.filter((j) =>
        ((j.job_description || j.description || '').toLowerCase()).includes('*_test'),
      );
    }

    const processed = processJobs({
      jobs: filteredJobs,
      lineItems,
      contacts,
      companies,
      materials,
      activities,
      staff,
      jobTypes,
      excludedUuids,
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      range: {
        from: from ? from.toISOString().slice(0, 10) : null,
        to: to ? to.toISOString().slice(0, 10) : null,
        all,
      },
      testMode,
      totalJobs: processed.length,
      kpis: topLevelKpis(processed),
      byStatus: summariseByStatus(processed),
      byJobType: summariseByJobType(processed, jobTypes),
      jobs: processed,
      jobTypes,
      targets,
    });
  } catch (error) {
    console.error('QMT API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { loadAll } from '@/lib/jobs-source';
import {
  processJobs,
  summariseByStatus,
  summariseByJobType,
  topLevelKpis,
  fyForDate,
  fyDateRange,
} from '@/lib/qmt-calc';
import { DEFAULT_JOB_TYPES } from '@/lib/qmt-config';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function loadJobTypesFromConfig() {
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
    const types = rows
      .filter((r) => r[0] === 'job_type' && r[1])
      .map((r) => ({ tag: r[1], label: r[2] || r[1] }));
    return types.length > 0 ? types : DEFAULT_JOB_TYPES;
  } catch {
    return DEFAULT_JOB_TYPES;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fyParam = searchParams.get('fy');
    const fy = fyParam ? Number(fyParam) : fyForDate(new Date());
    const all = searchParams.get('all') === '1';

    const [{ jobs, lineItems, contacts, companies }, jobTypes] = await Promise.all([
      loadAll(),
      loadJobTypesFromConfig(),
    ]);

    let filteredJobs = jobs;
    if (!all) {
      const { start, end } = fyDateRange(fy);
      filteredJobs = jobs.filter((j) => {
        const dStr = j.date || j.quote_date || '';
        if (!dStr || dStr.startsWith('0000')) return false;
        const d = new Date(dStr.replace(' ', 'T'));
        return d >= start && d < end;
      });
    }

    const processed = processJobs({
      jobs: filteredJobs,
      lineItems,
      contacts,
      companies,
      jobTypes,
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      fy,
      scope: all ? 'all' : `FY${String(fy).slice(-2)}`,
      totalJobs: processed.length,
      kpis: topLevelKpis(processed),
      byStatus: summariseByStatus(processed),
      byJobType: summariseByJobType(processed, jobTypes),
      jobs: processed,
      jobTypes,
    });
  } catch (error) {
    console.error('QMT API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

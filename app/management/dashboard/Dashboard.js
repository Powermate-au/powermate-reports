'use client';

import { useEffect, useMemo, useState } from 'react';
import { STAFF } from '@/lib/questions';
import { ymd } from '@/lib/dates';
import { isNeutralText } from '@/lib/neutral-text';
import StaffPanel from './StaffPanel';

function parseAuTimestamp(s) {
  if (!s) return null;
  const datePart = s.toString().split(',')[0].trim();
  const parts = datePart.split('/').map((n) => Number(n));
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] !== undefined ? row[i] : '';
  });
  return obj;
}

// helpIsNeutral is just the shared neutral-text check — kept as a local alias
// to keep the existing call sites readable.
const helpIsNeutral = isNeutralText;

function formatLongDate(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function Dashboard() {
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => ymd(new Date()));
  const [activeStaffId, setActiveStaffId] = useState(STAFF[0].id);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheets?tab=Daily Reports');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setHeaders(data.headers || []);
      setRawRows(data.rows || []);
      setLastLoaded(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const records = useMemo(
    () => rawRows.map((r) => rowToObject(headers, r)),
    [headers, rawRows],
  );

  // For the selected date, keep the latest submission per staff member.
  const submissionsByStaff = useMemo(() => {
    const map = {};
    STAFF.forEach((s) => (map[s.id] = null));
    records.forEach((rec) => {
      const ts = parseAuTimestamp(rec.timestamp);
      if (!ts) return;
      if (ymd(ts) !== selectedDate) return;
      const staff = STAFF.find(
        (s) => s.name.toLowerCase() === (rec.staff_name || '').toLowerCase(),
      );
      if (!staff) return;
      // Append order is chronological — last write wins.
      map[staff.id] = rec;
    });
    return map;
  }, [records, selectedDate]);

  const kpis = useMemo(() => {
    const submissions = STAFF.map((s) => submissionsByStaff[s.id]).filter(Boolean);
    const submitted = submissions.length;
    const total = STAFF.length;

    const prioritiesDone = submissions.filter(
      (r) => (r.priorities_done || '').toLowerCase().trim() === 'yes',
    ).length;

    const needHelp = submissions.filter((r) => !helpIsNeutral(r.help_needed)).length;

    let flags = 0;
    submissions.forEach((r) => {
      Object.entries(r).forEach(([k, v]) => {
        if (k === 'timestamp' || k === 'staff_name' || k === 'staff_role' || k === 'form_type') return;
        if (typeof v !== 'string') return;
        if (v.toLowerCase().trim() === 'no') flags++;
      });
      if (!helpIsNeutral(r.help_needed)) flags++;
      if (!r.priority_1?.trim() || !r.priority_2?.trim() || !r.priority_3?.trim())
        flags++;
    });

    return { submitted, total, prioritiesDone, needHelp, flags };
  }, [submissionsByStaff]);

  const todayYmd = ymd(new Date());
  const yesterdayYmd = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return ymd(d);
  })();

  const activeStaff = STAFF.find((s) => s.id === activeStaffId) || STAFF[0];
  const activeRow = submissionsByStaff[activeStaff.id];

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 sm:px-8 py-7">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="font-condensed text-2xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
          Daily Reports
        </h1>
        <span className="hidden sm:inline font-mono text-xs text-pm-text-3">
          {formatLongDate(todayYmd)}
        </span>
      </div>
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Submitted"
            value={`${kpis.submitted}/${kpis.total}`}
            sub={
              kpis.submitted === kpis.total
                ? 'All in'
                : kpis.submitted === 0
                ? 'Waiting on responses'
                : 'Waiting on responses'
            }
            tone={
              kpis.submitted === kpis.total ? 'good' : kpis.submitted === 0 ? 'warn' : ''
            }
          />
          <KpiCard
            label="Priorities done"
            value={kpis.submitted > 0 ? kpis.prioritiesDone : '—'}
            sub={kpis.submitted > 0 ? `of ${kpis.submitted} submitted` : ''}
            tone={
              kpis.submitted === 0
                ? ''
                : kpis.prioritiesDone === kpis.submitted
                ? 'good'
                : 'warn'
            }
          />
          <KpiCard
            label="Need help"
            value={kpis.submitted > 0 ? kpis.needHelp : '—'}
            sub={
              kpis.needHelp > 0
                ? 'Action required'
                : kpis.submitted > 0
                ? 'All good'
                : ''
            }
            tone={kpis.needHelp > 0 ? 'warn' : ''}
          />
          <KpiCard
            label="Flags today"
            value={kpis.submitted > 0 ? kpis.flags : '—'}
            sub={
              kpis.flags > 0
                ? 'Review below'
                : kpis.submitted > 0
                ? 'No issues'
                : ''
            }
            tone={kpis.flags > 0 ? 'warn' : kpis.submitted > 0 ? 'good' : ''}
          />
        </div>

        {/* Date navigation */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-pm-text-2">Viewing:</span>
          <DateChip
            active={selectedDate === todayYmd}
            onClick={() => setSelectedDate(todayYmd)}
          >
            Today
          </DateChip>
          <DateChip
            active={selectedDate === yesterdayYmd}
            onClick={() => setSelectedDate(yesterdayYmd)}
          >
            Yesterday
          </DateChip>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-pm-border-2 bg-pm-surface px-2.5 py-1.5 text-[13px] text-pm-text outline-none transition-colors focus:border-pm-orange"
          />
          <span className="ml-2 text-[12px] italic text-pm-text-3">
            {formatLongDate(selectedDate)}
          </span>
        </div>

        {/* Staff tabs + refresh */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex gap-1 rounded-lg border border-pm-border bg-pm-surface p-1">
            {STAFF.map((s) => {
              const active = s.id === activeStaffId;
              const submitted = !!submissionsByStaff[s.id];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStaffId(s.id)}
                  className={`flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? 'bg-pm-orange text-white'
                      : 'text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
                  }`}
                >
                  {s.name.split(' ')[0]}
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      submitted
                        ? active
                          ? 'bg-white'
                          : 'bg-pm-green'
                        : active
                        ? 'bg-white/40'
                        : 'bg-pm-border-2'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-pm-text-3">
              {loading
                ? 'Loading…'
                : error
                ? `Error: ${error}`
                : lastLoaded
                ? `Loaded ${lastLoaded.toLocaleTimeString('en-AU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </span>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-md border border-pm-border-2 bg-transparent px-4 py-1.5 text-[13px] font-medium text-pm-text-2 transition-colors hover:bg-pm-surface-2 hover:text-pm-text disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading && records.length === 0 ? (
          <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-12 text-center text-sm text-pm-text-3">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-pm-border border-t-pm-orange" />
            Loading submissions…
          </div>
        ) : (
          <StaffPanel staff={activeStaff} row={activeRow} />
        )}
    </main>
  );
}

function KpiCard({ label, value, sub, tone }) {
  const numCls =
    tone === 'good'
      ? 'text-pm-green'
      : tone === 'warn'
      ? 'text-pm-red'
      : 'text-pm-text';
  return (
    <div className="rounded-lg border border-pm-border bg-pm-surface px-5 py-4">
      <div className={`text-3xl font-semibold leading-none tracking-[-1px] ${numCls}`}>
        {value}
      </div>
      <div className="mt-2 font-condensed text-[11px] font-bold uppercase tracking-[0.08em] text-pm-text-3">
        {label}
      </div>
      {sub && <div className="mt-1 text-[12px] text-pm-text-2">{sub}</div>}
    </div>
  );
}

function DateChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
        active
          ? 'border-pm-text bg-pm-text text-white'
          : 'border-pm-border bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
      }`}
    >
      {children}
    </button>
  );
}

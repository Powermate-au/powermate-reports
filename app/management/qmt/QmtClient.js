'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import JobDetailDrawer from './JobDetailDrawer';

const STATUS_ORDER = ['Quote', 'Work Order', 'Completed', 'Unsuccessful'];

function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: '2-digit' });
}

function statusToneCls(status) {
  switch (status) {
    case 'Quote':
      return 'bg-pm-orange-bg text-pm-orange';
    case 'Work Order':
      return 'bg-pm-ocean/10 text-pm-ocean';
    case 'Completed':
      return 'bg-pm-green-bg text-pm-green';
    case 'Unsuccessful':
      return 'bg-pm-red-bg text-pm-red';
    default:
      return 'bg-pm-surface-2 text-pm-text-3';
  }
}

function marginToneCls(margin, target = 0.3) {
  if (margin === null || margin === undefined || isNaN(margin)) return 'text-pm-text-3';
  if (margin >= target) return 'text-pm-green';
  if (margin >= target - 0.15) return 'text-pm-text';
  return 'text-pm-red';
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function startOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
function endOfQuarter(d) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59);
}

function presetRange(name) {
  const now = new Date();
  switch (name) {
    case 'thisMonth':
      return { from: ymd(startOfMonth(now)), to: ymd(now) };
    case 'lastMonth': {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      return { from: ymd(startOfMonth(last)), to: ymd(endOfMonth(last)) };
    }
    case 'thisQuarter':
      return { from: ymd(startOfQuarter(now)), to: ymd(now) };
    case 'lastQuarter': {
      const last = new Date(now.getFullYear(), now.getMonth() - 3, 15);
      return { from: ymd(startOfQuarter(last)), to: ymd(endOfQuarter(last)) };
    }
    case 'last30':
      return { from: ymd(new Date(now - 30 * 86400000)), to: ymd(now) };
    case 'last90':
      return { from: ymd(new Date(now - 90 * 86400000)), to: ymd(now) };
    case 'ytd':
      return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: ymd(now) };
    case 'all':
      return { all: true };
    default:
      return null;
  }
}

const PRESETS = [
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisQuarter', label: 'This quarter' },
  { id: 'lastQuarter', label: 'Last quarter' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'last90', label: 'Last 90 days' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All time' },
];

export default function QmtClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(() => ({ ...presetRange('thisMonth'), preset: 'thisMonth' }));
  const [filter, setFilter] = useState({ statuses: [], jobTypes: [], search: '' });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [openJobUuid, setOpenJobUuid] = useState(null);
  const [viewMode, setViewMode] = useState('actual'); // 'actual' | 'estimated'
  const [testMode, setTestMode] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.all) params.set('all', '1');
      else {
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      }
      if (testMode) params.set('test', '1');
      const res = await fetch(`/api/qmt?${params.toString()}`);
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [range.from, range.to, range.all, testMode]);

  const filtered = useMemo(() => {
    if (!data?.jobs) return [];
    let rows = data.jobs;
    if (filter.statuses.length > 0) rows = rows.filter((r) => filter.statuses.includes(r.status));
    if (filter.jobTypes.length > 0) rows = rows.filter((r) => filter.jobTypes.includes(r.jobType));
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.customer || '').toLowerCase().includes(q) ||
          (r.jobNumber || '').toLowerCase().includes(q) ||
          (r.po || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = sortKey.includes('.') ? sortKey.split('.').reduce((o, k) => o?.[k], a) : a[sortKey];
      const bv = sortKey.includes('.') ? sortKey.split('.').reduce((o, k) => o?.[k], b) : b[sortKey];
      if (av === bv) return 0;
      if (av === undefined || av === null || av === '') return 1;
      if (bv === undefined || bv === null || bv === '') return -1;
      return av > bv ? dir : -dir;
    });
    return rows;
  }, [data, filter, sortKey, sortDir]);

  // Filter-aware analysis window aggregation. Recomputes from filtered list
  // so the summary respects status/jobType/search filters.
  const summary = useMemo(() => {
    const buckets = {};
    const ensure = (k) => {
      if (!buckets[k]) {
        buckets[k] = {
          status: k,
          count: 0,
          revenue: 0,
          actRevenue: 0,
          gpIncEst: 0,
          gpExEst: 0,
          gpIncAct: 0,
          gpExAct: 0,
          actCount: 0,
        };
      }
      return buckets[k];
    };
    filtered.forEach((p) => {
      const b = ensure(p.status);
      b.count += 1;
      b.revenue += p.estimated.totalRevenue;
      b.gpIncEst += p.estimated.gpIncLabour;
      b.gpExEst += p.estimated.gpExLabour;
      if (p.actual) {
        b.actCount += 1;
        b.actRevenue += p.actual.totalRevenue;
        b.gpIncAct += p.actual.gpIncLabour;
        b.gpExAct += p.actual.gpExLabour;
      }
    });
    const rows = STATUS_ORDER.map((s) => buckets[s]).filter(Boolean);
    // Compute Total
    const total = rows.reduce(
      (acc, b) => {
        acc.count += b.count;
        acc.revenue += b.revenue;
        acc.actRevenue += b.actRevenue;
        acc.gpIncEst += b.gpIncEst;
        acc.gpExEst += b.gpExEst;
        acc.gpIncAct += b.gpIncAct;
        acc.gpExAct += b.gpExAct;
        acc.actCount += b.actCount;
        return acc;
      },
      { status: 'Total', count: 0, revenue: 0, actRevenue: 0, gpIncEst: 0, gpExEst: 0, gpIncAct: 0, gpExAct: 0, actCount: 0 },
    );
    return { rows, total };
  }, [filtered]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function applyPreset(id) {
    const r = presetRange(id);
    setRange({ ...r, preset: id });
  }

  function setCustomDate(field, value) {
    setRange({ ...range, [field]: value, all: false, preset: 'custom' });
  }

  const rangeLabel = data?.range?.all
    ? 'All time'
    : data?.range?.from || data?.range?.to
    ? `${data.range.from || '…'} → ${data.range.to || '…'}`
    : '';

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-8 py-7">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-condensed text-2xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
            Quoted Margin Tracker
          </h1>
          {data && (
            <p className="mt-0.5 font-mono text-[11px] text-pm-text-3">
              {rangeLabel} · {data.totalJobs} jobs · loaded{' '}
              {new Date(data.generatedAt).toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTestMode(!testMode)}
            className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              testMode
                ? 'border-pm-orange bg-pm-orange text-white'
                : 'border-pm-border-2 bg-transparent text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
            }`}
            title="Show only jobs tagged with *_test in their description"
          >
            {testMode ? '● Test mode on' : '○ Test mode'}
          </button>
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.id)}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              range.preset === p.id
                ? 'border-pm-text bg-pm-text text-white'
                : 'border-pm-border bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-2 flex items-center gap-2 border-l border-pm-border pl-3">
          <input
            type="date"
            value={range.from || ''}
            onChange={(e) => setCustomDate('from', e.target.value)}
            className="rounded-md border border-pm-border-2 bg-pm-surface px-2 py-1 text-[12px] text-pm-text"
          />
          <span className="text-pm-text-3">→</span>
          <input
            type="date"
            value={range.to || ''}
            onChange={(e) => setCustomDate('to', e.target.value)}
            className="rounded-md border border-pm-border-2 bg-pm-surface px-2 py-1 text-[12px] text-pm-text"
          />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-pm-red-border bg-pm-red-bg p-4 text-[13px] text-pm-red">
          <strong>Error loading data:</strong> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-12 text-center text-sm text-pm-text-3">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-pm-border border-t-pm-orange" />
          Loading from ServiceM8…
          <div className="mt-1 text-[11px] text-pm-text-3/70">First load can take 10–15s.</div>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Total quoted value" value={fmtMoney(data.kpis.totalQuotedValue)} sub={`${data.kpis.total} jobs`} />
            <KpiCard
              label="Won value"
              value={fmtMoney(data.kpis.wonValue)}
              sub={`${data.kpis.won} jobs (${fmtPct(data.kpis.winRatio)} of total)`}
              tone="good"
            />
            <KpiCard
              label="Win ratio (decided)"
              value={fmtPct(data.kpis.winRatioDecided)}
              sub={`${data.kpis.won} won / ${data.kpis.lost} lost`}
            />
            <KpiCard
              label="Avg margin Inc Lab"
              value={`${fmtPct(data.kpis.avgEstMarginInc)} → ${fmtPct(data.kpis.avgActMarginInc)}`}
              sub="Est → Actual"
              tone={data.kpis.avgActMarginInc >= 0.3 ? 'good' : data.kpis.avgActMarginInc >= 0.15 ? '' : 'warn'}
            />
          </div>

          <AnalysisWindow
            summary={summary}
            viewMode={viewMode}
            setViewMode={setViewMode}
            targets={data.targets || { incLabour: 0.425, exLabour: 0.593 }}
            filterCaption={buildFilterCaption({ data, filter, range, testMode, count: filtered.length })}
          />

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.05em] text-pm-text-3">Filter:</span>
            <MultiSelect
              label="Status"
              options={STATUS_ORDER.map((s) => ({ value: s, label: s }))}
              selected={filter.statuses}
              onChange={(next) => setFilter({ ...filter, statuses: next })}
            />
            <MultiSelect
              label="Type"
              options={[
                ...data.jobTypes.map((t) => ({ value: t.tag, label: t.label })),
                { value: 'untagged', label: 'Untagged' },
              ]}
              selected={filter.jobTypes}
              onChange={(next) => setFilter({ ...filter, jobTypes: next })}
            />
            <input
              type="text"
              placeholder="Search customer / job # / PO…"
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="flex-1 min-w-[200px] rounded-md border border-pm-border-2 bg-pm-surface px-3 py-1 text-[12px] text-pm-text"
            />
            <span className="text-[11px] text-pm-text-3">Showing {filtered.length}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-pm-border bg-pm-surface">
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                <tr className="border-b border-pm-border bg-pm-bg/50">
                  <th colSpan={5} className="px-3 py-1.5"></th>
                  <th colSpan={3} className="px-3 py-1.5 text-center font-medium border-l border-pm-border bg-pm-orange-bg/30">Estimated</th>
                  <th colSpan={3} className="px-3 py-1.5 text-center font-medium border-l border-pm-border bg-pm-green-bg/20">Actual</th>
                </tr>
                <tr className="border-b border-pm-border bg-pm-bg/50">
                  <Th onClick={() => toggleSort('date')} active={sortKey === 'date'} dir={sortDir}>Date</Th>
                  <Th onClick={() => toggleSort('jobNumber')} active={sortKey === 'jobNumber'} dir={sortDir}>Job #</Th>
                  <Th onClick={() => toggleSort('customer')} active={sortKey === 'customer'} dir={sortDir}>Customer</Th>
                  <Th onClick={() => toggleSort('jobType')} active={sortKey === 'jobType'} dir={sortDir}>Type</Th>
                  <Th onClick={() => toggleSort('status')} active={sortKey === 'status'} dir={sortDir}>Status</Th>
                  <Th onClick={() => toggleSort('estimated.totalRevenue')} active={sortKey === 'estimated.totalRevenue'} dir={sortDir} align="right">Revenue</Th>
                  <Th onClick={() => toggleSort('estimated.totalCost')} active={sortKey === 'estimated.totalCost'} dir={sortDir} align="right">Cost</Th>
                  <Th onClick={() => toggleSort('estimated.marginIncLabour')} active={sortKey === 'estimated.marginIncLabour'} dir={sortDir} align="right">M%</Th>
                  <Th onClick={() => toggleSort('actual.totalRevenue')} active={sortKey === 'actual.totalRevenue'} dir={sortDir} align="right">Revenue</Th>
                  <Th onClick={() => toggleSort('actual.totalCost')} active={sortKey === 'actual.totalCost'} dir={sortDir} align="right">Cost</Th>
                  <Th onClick={() => toggleSort('actual.marginIncLabour')} active={sortKey === 'actual.marginIncLabour'} dir={sortDir} align="right">M%</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-sm text-pm-text-3">
                      No jobs match your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((j) => (
                    <tr
                      key={j.uuid}
                      onClick={() => setOpenJobUuid(j.uuid)}
                      className="cursor-pointer border-b border-pm-border last:border-b-0 hover:bg-pm-orange-bg/30"
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] text-pm-text-3">{fmtDate(j.date)}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-pm-orange">{j.jobNumber || j.po || '—'}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={j.customer}>{j.customer || '—'}</td>
                      <td className="px-3 py-1.5 text-[11px] text-pm-text-2">
                        {data.jobTypes.find((t) => t.tag === j.jobType)?.label || j.jobType}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusToneCls(j.status)}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono border-l border-pm-border">
                        {fmtMoney(j.estimated.totalRevenue)}
                        {j.estimated.stcValue > 0 && (
                          <div className="text-[9px] text-pm-text-3">inv {fmtMoney(j.estimated.invoice)}</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-pm-text-3">{fmtMoney(j.estimated.totalCost)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${marginToneCls(j.estimated.marginIncLabour)}`}>
                        {fmtPct(j.estimated.marginIncLabour)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono border-l border-pm-border">{j.actual ? fmtMoney(j.actual.totalRevenue) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-pm-text-3">{j.actual ? fmtMoney(j.actual.totalCost) : '—'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${j.actual ? marginToneCls(j.actual.marginIncLabour) : 'text-pm-text-3'}`}>
                        {j.actual ? fmtPct(j.actual.marginIncLabour) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-md border border-pm-border bg-pm-surface px-4 py-3 text-[11px] text-pm-text-3">
            <strong className="text-pm-text-2">Tip:</strong> Click any job row to see its raw line items, bundles
            (quote vs actuals snapshot), timesheet activities, and how the totals were calculated. Use this to verify
            and tell us what the calc should look like.
          </div>
        </>
      ) : null}

      {openJobUuid && (
        <JobDetailDrawer uuid={openJobUuid} onClose={() => setOpenJobUuid(null)} />
      )}
    </main>
  );
}

function KpiCard({ label, value, sub, tone }) {
  const numCls = tone === 'good' ? 'text-pm-green' : tone === 'warn' ? 'text-pm-red' : 'text-pm-text';
  return (
    <div className="rounded-lg border border-pm-border bg-pm-surface px-5 py-4">
      <div className={`text-2xl font-semibold leading-none tracking-[-1px] ${numCls}`}>{value}</div>
      <div className="mt-2 font-condensed text-[11px] font-bold uppercase tracking-[0.08em] text-pm-text-3">
        {label}
      </div>
      {sub && <div className="mt-1 text-[12px] text-pm-text-2">{sub}</div>}
    </div>
  );
}

function Th({ children, onClick, active, dir, align = 'left' }) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 font-medium text-${align === 'right' ? 'right' : 'left'} hover:text-pm-text ${
        active ? 'text-pm-orange' : ''
      }`}
    >
      {children} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle(v) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  const summary = selected.length === 0 ? `All ${label.toLowerCase()}` : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-md border bg-pm-surface px-3 py-1 text-[12px] text-pm-text transition-colors ${
          selected.length > 0 ? 'border-pm-orange text-pm-orange' : 'border-pm-border-2'
        }`}
      >
        {summary} ▾
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-pm-border bg-pm-surface shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="block w-full border-b border-pm-border px-3 py-1.5 text-left text-[11px] text-pm-text-3 hover:bg-pm-surface-2 hover:text-pm-text"
            >
              Clear all
            </button>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] text-pm-text hover:bg-pm-surface-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="accent-pm-orange"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildFilterCaption({ data, filter, range, testMode, count }) {
  const parts = [];
  if (testMode) parts.push('Test mode (*_test)');
  parts.push(`${count} job${count === 1 ? '' : 's'}`);
  if (filter.statuses.length > 0) parts.push(filter.statuses.join(', '));
  if (filter.jobTypes.length > 0) {
    const labels = filter.jobTypes.map(
      (tag) => data?.jobTypes?.find((t) => t.tag === tag)?.label || tag,
    );
    parts.push(labels.join(', '));
  }
  if (filter.search) parts.push(`"${filter.search}"`);
  if (range.all) parts.push('All time');
  else if (range.from || range.to) parts.push(`${range.from || '…'} → ${range.to || '…'}`);
  return parts.join(' · ');
}

function AnalysisWindow({ summary, viewMode, setViewMode, targets, filterCaption }) {
  const isActual = viewMode === 'actual';
  const variance = (margin, target) =>
    margin === null || margin === undefined ? null : margin - target;

  // Build display rows per status + Total
  const rowFor = (b) => {
    const hasActuals = b.status === 'Work Order' || b.status === 'Completed' || b.status === 'Total';
    // In Actual view, Quote/Unsuccessful have no real actuals — show — rather
    // than silently falling back to estimated values.
    if (isActual && !hasActuals) {
      return { ...b, revenueShown: null, gpInc: null, gpEx: null, mInc: null, mEx: null, hasActuals, showActual: false };
    }
    const showActual = isActual && hasActuals;
    const denom = showActual ? b.actRevenue : b.revenue;
    const gpInc = showActual ? b.gpIncAct : b.gpIncEst;
    const gpEx = showActual ? b.gpExAct : b.gpExEst;
    const mInc = denom > 0 ? gpInc / denom : null;
    const mEx = denom > 0 ? gpEx / denom : null;
    return { ...b, revenueShown: denom, gpInc, gpEx, mInc, mEx, hasActuals, showActual };
  };

  const rows = summary.rows.map(rowFor);
  const totalRow = rowFor(summary.total);

  return (
    <div className="mb-6 rounded-lg border border-pm-border bg-pm-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-pm-border px-4 py-2">
        <div>
          <div className="font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-orange">
            Summary analysis
          </div>
          <div className="mt-0.5 text-[11px] text-pm-text-3">{filterCaption}</div>
        </div>
        <div className="inline-flex gap-0.5 rounded-md border border-pm-border bg-pm-bg p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('estimated')}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              viewMode === 'estimated' ? 'bg-pm-orange text-white' : 'text-pm-text-2 hover:text-pm-text'
            }`}
          >
            Estimated
          </button>
          <button
            type="button"
            onClick={() => setViewMode('actual')}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              viewMode === 'actual' ? 'bg-pm-orange text-white' : 'text-pm-text-2 hover:text-pm-text'
            }`}
          >
            Actual
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
            <tr className="border-b border-pm-border">
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Jobs</th>
              <th className="px-3 py-2 font-medium text-right">Revenue</th>
              <th className="px-3 py-2 font-medium text-right">Target Inc</th>
              <th className="px-3 py-2 font-medium text-right">GP Inc Lab</th>
              <th className="px-3 py-2 font-medium text-right">M% Inc Lab</th>
              <th className="px-3 py-2 font-medium text-right border-l border-pm-border">Target Ex</th>
              <th className="px-3 py-2 font-medium text-right">GP Ex Lab</th>
              <th className="px-3 py-2 font-medium text-right">M% Ex Lab</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <AnalysisRow key={r.status} r={r} targets={targets} variance={variance} isTotal={false} />
            ))}
          </tbody>
          <tfoot>
            <AnalysisRow r={totalRow} targets={targets} variance={variance} isTotal={true} />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AnalysisRow({ r, targets, variance, isTotal }) {
  const vInc = variance(r.mInc, targets.incLabour);
  const vEx = variance(r.mEx, targets.exLabour);
  const cls = isTotal ? 'border-t-2 border-pm-border bg-pm-bg/30 font-medium' : 'border-b border-pm-border last:border-b-0';
  const vClass = (v) =>
    v === null || v === undefined ? 'text-pm-text-3' : v >= 0 ? 'text-pm-green' : 'text-pm-red';
  const vTxt = (v) => (v === null || v === undefined ? '' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);
  return (
    <tr className={cls}>
      <td className="px-3 py-2">
        {isTotal ? (
          <span className="font-medium">Total</span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusToneCls(r.status)}`}>
            {r.status}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono">{r.count}</td>
      <td className="px-3 py-2 text-right font-mono">
        {r.revenueShown > 0 ? fmtMoney(r.revenueShown) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-mono text-pm-text-3">{fmtPct(targets.incLabour)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.mInc === null ? '—' : fmtMoney(r.gpInc)}</td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mInc, targets.incLabour)}`}>
        {r.mInc === null ? '—' : (
          <span>
            {fmtPct(r.mInc)} <span className={`text-[10px] ${vClass(vInc)}`}>{vTxt(vInc)}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-pm-text-3 border-l border-pm-border">{fmtPct(targets.exLabour)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.mEx === null ? '—' : fmtMoney(r.gpEx)}</td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mEx, targets.exLabour)}`}>
        {r.mEx === null ? '—' : (
          <span>
            {fmtPct(r.mEx)} <span className={`text-[10px] ${vClass(vEx)}`}>{vTxt(vEx)}</span>
          </span>
        )}
      </td>
    </tr>
  );
}

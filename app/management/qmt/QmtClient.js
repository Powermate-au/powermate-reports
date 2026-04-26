'use client';

import { useEffect, useMemo, useState } from 'react';

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

function currentFy() {
  const d = new Date();
  return d.getMonth() + 1 >= 7 ? d.getFullYear() + 1 : d.getFullYear();
}

export default function QmtClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scope, setScope] = useState({ fy: currentFy(), all: false });
  const [filter, setFilter] = useState({ status: 'All', jobType: 'All', search: '' });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = scope.all ? '?all=1' : `?fy=${scope.fy}`;
      const res = await fetch(`/api/qmt${qs}`);
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
  }, [scope.fy, scope.all]);

  const filtered = useMemo(() => {
    if (!data?.jobs) return [];
    let rows = data.jobs;
    if (filter.status !== 'All') rows = rows.filter((r) => r.status === filter.status);
    if (filter.jobType !== 'All') rows = rows.filter((r) => r.jobType === filter.jobType);
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

  function toggleSort(key) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const fyOptions = [];
  const cFy = currentFy();
  for (let y = cFy; y >= cFy - 4; y--) fyOptions.push(y);

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 sm:px-8 py-7">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-condensed text-2xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
            Quoted Margin Tracker
          </h1>
          {data && (
            <p className="mt-0.5 font-mono text-[11px] text-pm-text-3">
              {data.scope} · {data.totalJobs} jobs · loaded{' '}
              {new Date(data.generatedAt).toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scope.all ? 'all' : String(scope.fy)}
            onChange={(e) => {
              if (e.target.value === 'all') setScope({ ...scope, all: true });
              else setScope({ fy: Number(e.target.value), all: false });
            }}
            className="rounded-md border border-pm-border-2 bg-pm-surface px-3 py-1.5 text-[13px] text-pm-text"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                FY{String(y).slice(-2)} (Jul {y - 1} – Jun {y})
              </option>
            ))}
            <option value="all">All time</option>
          </select>
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

      {error && (
        <div className="mb-5 rounded-lg border border-pm-red-border bg-pm-red-bg p-4 text-[13px] text-pm-red">
          <strong>Error loading data:</strong> {error}
          <div className="mt-1 text-[11px]">
            Make sure <code>SERVICEM8_API_KEY</code> is set in your environment.
          </div>
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
              label="Avg margin (Inc Lab)"
              value={fmtPct(data.kpis.avgMarginIncLabour)}
              sub="across all quoted"
              tone={data.kpis.avgMarginIncLabour >= 0.3 ? 'good' : data.kpis.avgMarginIncLabour >= 0.15 ? '' : 'warn'}
            />
          </div>

          <div className="mb-6 overflow-x-auto rounded-lg border border-pm-border bg-pm-surface">
            <div className="border-b border-pm-border px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-orange">
              By status
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-[0.05em] text-pm-text-3">
                <tr className="border-b border-pm-border">
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Jobs</th>
                  <th className="px-4 py-2 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2 font-medium text-right">GP (Inc Lab)</th>
                  <th className="px-4 py-2 font-medium text-right">Margin (Inc Lab)</th>
                  <th className="px-4 py-2 font-medium text-right">GP (Ex Lab)</th>
                  <th className="px-4 py-2 font-medium text-right">Margin (Ex Lab)</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_ORDER.concat(
                  data.byStatus.map((s) => s.status).filter((s) => !STATUS_ORDER.includes(s)),
                ).map((statusName) => {
                  const r = data.byStatus.find((s) => s.status === statusName);
                  if (!r) return null;
                  return (
                    <tr key={r.status} className="border-b border-pm-border last:border-b-0">
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusToneCls(r.status)}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{r.count}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtMoney(r.revenue)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtMoney(r.gpIncLabour)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${marginToneCls(r.marginIncLabour)}`}>
                        {fmtPct(r.marginIncLabour)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{fmtMoney(r.gpExLabour)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${marginToneCls(r.marginExLabour, 0.5)}`}>
                        {fmtPct(r.marginExLabour)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-6 overflow-x-auto rounded-lg border border-pm-border bg-pm-surface">
            <div className="border-b border-pm-border px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-orange">
              By job type
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-[0.05em] text-pm-text-3">
                <tr className="border-b border-pm-border">
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium text-right">Quoted</th>
                  <th className="px-4 py-2 font-medium text-right">Won</th>
                  <th className="px-4 py-2 font-medium text-right">Lost</th>
                  <th className="px-4 py-2 font-medium text-right">Win % (Decided)</th>
                  <th className="px-4 py-2 font-medium text-right">Avg M (Inc Lab)</th>
                  <th className="px-4 py-2 font-medium text-right">Avg M (Ex Lab)</th>
                </tr>
              </thead>
              <tbody>
                {data.byJobType.map((r) => (
                  <tr key={r.tag} className="border-b border-pm-border last:border-b-0">
                    <td className="px-4 py-2 text-pm-text">{r.label}</td>
                    <td className="px-4 py-2 text-right font-mono">{r.totalQuoted}</td>
                    <td className="px-4 py-2 text-right font-mono text-pm-green">{r.won}</td>
                    <td className="px-4 py-2 text-right font-mono text-pm-red">{r.lost}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmtPct(r.winRatioDecided)}</td>
                    <td className={`px-4 py-2 text-right font-mono ${marginToneCls(r.avgMarginIncLabour)}`}>
                      {fmtPct(r.avgMarginIncLabour)}
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${marginToneCls(r.avgMarginExLabour, 0.5)}`}>
                      {fmtPct(r.avgMarginExLabour)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.05em] text-pm-text-3">Filter:</span>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="rounded-md border border-pm-border-2 bg-pm-surface px-2 py-1 text-[12px] text-pm-text"
            >
              <option>All</option>
              {STATUS_ORDER.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filter.jobType}
              onChange={(e) => setFilter({ ...filter, jobType: e.target.value })}
              className="rounded-md border border-pm-border-2 bg-pm-surface px-2 py-1 text-[12px] text-pm-text"
            >
              <option value="All">All types</option>
              {data.jobTypes.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.label}
                </option>
              ))}
              <option value="untagged">Untagged</option>
            </select>
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
                  <Th onClick={() => toggleSort('date')} active={sortKey === 'date'} dir={sortDir}>Date</Th>
                  <Th onClick={() => toggleSort('jobNumber')} active={sortKey === 'jobNumber'} dir={sortDir}>Job #</Th>
                  <Th onClick={() => toggleSort('customer')} active={sortKey === 'customer'} dir={sortDir}>Customer</Th>
                  <Th onClick={() => toggleSort('jobType')} active={sortKey === 'jobType'} dir={sortDir}>Type</Th>
                  <Th onClick={() => toggleSort('status')} active={sortKey === 'status'} dir={sortDir}>Status</Th>
                  <Th onClick={() => toggleSort('totals.revenue')} active={sortKey === 'totals.revenue'} dir={sortDir} align="right">Revenue</Th>
                  <Th onClick={() => toggleSort('totals.totalCost')} active={sortKey === 'totals.totalCost'} dir={sortDir} align="right">Cost</Th>
                  <Th onClick={() => toggleSort('totals.gpIncLabour')} active={sortKey === 'totals.gpIncLabour'} dir={sortDir} align="right">GP (Inc)</Th>
                  <Th onClick={() => toggleSort('totals.marginIncLabour')} active={sortKey === 'totals.marginIncLabour'} dir={sortDir} align="right">M% (Inc)</Th>
                  <Th onClick={() => toggleSort('totals.marginExLabour')} active={sortKey === 'totals.marginExLabour'} dir={sortDir} align="right">M% (Ex)</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-pm-text-3">
                      No jobs match your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((j) => (
                    <tr key={j.uuid} className="border-b border-pm-border last:border-b-0 hover:bg-pm-bg/30">
                      <td className="px-3 py-1.5 font-mono text-[11px] text-pm-text-3">{fmtDate(j.date)}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">{j.jobNumber || j.po || '—'}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate" title={j.customer}>{j.customer || '—'}</td>
                      <td className="px-3 py-1.5 text-[11px] text-pm-text-2">
                        {data.jobTypes.find((t) => t.tag === j.jobType)?.label || j.jobType}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusToneCls(j.status)}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(j.totals.revenue)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-pm-text-3">{fmtMoney(j.totals.totalCost)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(j.totals.gpIncLabour)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${marginToneCls(j.totals.marginIncLabour)}`}>
                        {fmtPct(j.totals.marginIncLabour)}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono ${marginToneCls(j.totals.marginExLabour, 0.5)}`}>
                        {fmtPct(j.totals.marginExLabour)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-md border border-pm-border bg-pm-surface px-4 py-3 text-[11px] text-pm-text-3">
            <strong className="text-pm-text-2">Heads up:</strong> ServiceM8 doesn't expose a quote-vs-actual snapshot,
            so margins shown reflect the current state of each job's line items. Splitting Quoted vs Actual labour requires
            integrating /jobactivity timesheets — planned for Phase 2B.
          </div>
        </>
      ) : null}
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

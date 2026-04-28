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

function fmtPerHour(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}/hr`;
}

// Which reason list a job needs (if any). Negative-variance Completed →
// variance cause. Unsuccessful → loss reason. Otherwise: not applicable.
function reasonContextFor(job) {
  if (job.status === 'Unsuccessful') return 'loss';
  if (job.status === 'Completed' && job.actual && job.estimated) {
    if (job.actual.marginIncLabour < job.estimated.marginIncLabour) return 'variance';
  }
  return null;
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
  const [filter, setFilter] = useState({
    statuses: [],
    jobTypes: [],
    search: '',
    excludedOnly: false,
    belowDphTarget: false,
    belowMarginTarget: false,
    belowQuotedMargin: false,
  });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [openJobUuid, setOpenJobUuid] = useState(null);
  const [viewMode, setViewMode] = useState('actual'); // 'actual' | 'estimated'
  const [testMode, setTestMode] = useState(false);

  async function load({ fresh = false } = {}) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.all) params.set('all', '1');
      else {
        if (range.from) params.set('from', range.from);
        if (range.to) params.set('to', range.to);
      }
      if (fresh) params.set('fresh', '1');
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
  }, [range.from, range.to, range.all]);

  const filtered = useMemo(() => {
    if (!data?.jobs) return [];
    let rows = data.jobs;
    if (testMode) rows = rows.filter((r) => /\*_test\b/i.test(r.description || ''));
    if (filter.statuses.length > 0) rows = rows.filter((r) => filter.statuses.includes(r.status));
    if (filter.jobTypes.length > 0) rows = rows.filter((r) => filter.jobTypes.includes(r.jobType));
    if (filter.excludedOnly) rows = rows.filter((r) => r.excludedFromKpis);
    if (filter.belowDphTarget) {
      const globalDph = data?.targets?.dollarsPerHour ?? 150;
      const targetByTag = new Map(
        (data?.jobTypes || []).map((t) => [
          t.tag,
          Number.isFinite(t.targetDollarsPerHour) ? t.targetDollarsPerHour : globalDph,
        ]),
      );
      rows = rows.filter((r) => {
        const side = r.actual || r.estimated;
        if (!side || side.dollarsPerHour === null || side.dollarsPerHour === undefined) return false;
        const tgt = targetByTag.get(r.jobType) ?? globalDph;
        return side.dollarsPerHour < tgt;
      });
    }
    if (filter.belowMarginTarget) {
      const globalInc = data?.targets?.incLabour ?? 0.425;
      const targetByTag = new Map(
        (data?.jobTypes || []).map((t) => [
          t.tag,
          Number.isFinite(t.targetInc) ? t.targetInc : globalInc,
        ]),
      );
      rows = rows.filter((r) => {
        const side = r.actual || r.estimated;
        if (!side || side.marginIncLabour === null || side.marginIncLabour === undefined) return false;
        const tgt = targetByTag.get(r.jobType) ?? globalInc;
        return side.marginIncLabour < tgt;
      });
    }
    if (filter.belowQuotedMargin) {
      rows = rows.filter(
        (r) =>
          r.actual &&
          r.estimated &&
          r.actual.marginIncLabour < r.estimated.marginIncLabour,
      );
    }
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
  }, [data, filter, sortKey, sortDir, testMode]);

  // Filter-aware analysis window aggregation. Recomputes from filtered list
  // so the summary respects status/jobType/search filters.
  const summary = useMemo(() => {
    const globalIncTarget = data?.targets?.incLabour ?? 0.425;
    const globalExTarget = data?.targets?.exLabour ?? 0.593;
    const globalDphTarget = data?.targets?.dollarsPerHour ?? 150;
    const targetByTag = new Map();
    (data?.jobTypes || []).forEach((t) => {
      targetByTag.set(t.tag, {
        inc: Number.isFinite(t.targetInc) ? t.targetInc : globalIncTarget,
        ex: Number.isFinite(t.targetEx) ? t.targetEx : globalExTarget,
        dph: Number.isFinite(t.targetDollarsPerHour) ? t.targetDollarsPerHour : globalDphTarget,
      });
    });
    const targetsFor = (tag) =>
      targetByTag.get(tag) || { inc: globalIncTarget, ex: globalExTarget, dph: globalDphTarget };

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
          estHours: 0,
          actHours: 0,
          // Revenue-weighted target accumulators
          twIncSum: 0,
          twExSum: 0,
          twActIncSum: 0,
          twActExSum: 0,
          // Hours-weighted $/hr target accumulators (weighted by labour hours)
          twDphEstSum: 0,
          twDphActSum: 0,
        };
      }
      return buckets[k];
    };
    filtered.forEach((p) => {
      if (p.excludedFromKpis) return;
      const b = ensure(p.status);
      const tgt = targetsFor(p.jobType);
      b.count += 1;
      b.revenue += p.estimated.totalRevenue;
      b.gpIncEst += p.estimated.gpIncLabour;
      b.gpExEst += p.estimated.gpExLabour;
      b.estHours += p.estimated.labour.hours || 0;
      b.twIncSum += tgt.inc * p.estimated.totalRevenue;
      b.twExSum += tgt.ex * p.estimated.totalRevenue;
      b.twDphEstSum += tgt.dph * (p.estimated.labour.hours || 0);
      if (p.actual) {
        b.actCount += 1;
        b.actRevenue += p.actual.totalRevenue;
        b.gpIncAct += p.actual.gpIncLabour;
        b.gpExAct += p.actual.gpExLabour;
        b.actHours += p.actual.labour.hours || 0;
        b.twActIncSum += tgt.inc * p.actual.totalRevenue;
        b.twActExSum += tgt.ex * p.actual.totalRevenue;
        b.twDphActSum += tgt.dph * (p.actual.labour.hours || 0);
      }
    });
    const rows = STATUS_ORDER.map((s) => buckets[s]).filter(Boolean);
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
        acc.estHours += b.estHours;
        acc.actHours += b.actHours;
        acc.twIncSum += b.twIncSum;
        acc.twExSum += b.twExSum;
        acc.twActIncSum += b.twActIncSum;
        acc.twActExSum += b.twActExSum;
        acc.twDphEstSum += b.twDphEstSum;
        acc.twDphActSum += b.twDphActSum;
        return acc;
      },
      {
        status: 'Total',
        count: 0,
        revenue: 0,
        actRevenue: 0,
        gpIncEst: 0,
        gpExEst: 0,
        gpIncAct: 0,
        gpExAct: 0,
        actCount: 0,
        estHours: 0,
        actHours: 0,
        twIncSum: 0,
        twExSum: 0,
        twActIncSum: 0,
        twActExSum: 0,
        twDphEstSum: 0,
        twDphActSum: 0,
      },
    );
    return { rows, total };
  }, [filtered, data]);

  // Per-job-type breakdown using SM8's quote_sent flag so the Win % reflects
  // only quotes that actually went out to a customer (not pre-quote dropouts).
  const byJobType = useMemo(() => {
    const buckets = new Map();
    const labelByTag = new Map((data?.jobTypes || []).map((t) => [t.tag, t.label]));
    labelByTag.set('untagged', 'Untagged');
    filtered.forEach((p) => {
      if (p.excludedFromKpis) return;
      if (!p.quoteSent) return;
      const k = p.jobType;
      if (!buckets.has(k)) {
        buckets.set(k, {
          tag: k,
          label: labelByTag.get(k) || k,
          sent: 0,
          won: 0,
          lost: 0,
          estRevenue: 0,
          estGpInc: 0,
          actRevenue: 0,
          actGpInc: 0,
          estGpEx: 0,
          actGpEx: 0,
          estHours: 0,
          actHours: 0,
        });
      }
      const b = buckets.get(k);
      b.sent += 1;
      b.estRevenue += p.estimated.totalRevenue;
      b.estGpInc += p.estimated.gpIncLabour;
      b.estGpEx += p.estimated.gpExLabour;
      b.estHours += p.estimated.labour.hours || 0;
      if (p.status === 'Work Order' || p.status === 'Completed') b.won += 1;
      else if (p.status === 'Unsuccessful') b.lost += 1;
      if (p.actual) {
        b.actRevenue += p.actual.totalRevenue;
        b.actGpInc += p.actual.gpIncLabour;
        b.actGpEx += p.actual.gpExLabour;
        b.actHours += p.actual.labour.hours || 0;
      }
    });
    return Array.from(buckets.values())
      .map((b) => ({
        ...b,
        decided: b.won + b.lost,
        winRatio: b.won + b.lost > 0 ? b.won / (b.won + b.lost) : null,
        estMarginInc: b.estRevenue > 0 ? b.estGpInc / b.estRevenue : null,
        actMarginInc: b.actRevenue > 0 ? b.actGpInc / b.actRevenue : null,
        estDollarsPerHour: b.estHours > 0 ? b.estGpEx / b.estHours : null,
        actDollarsPerHour: b.actHours > 0 ? b.actGpEx / b.actHours : null,
      }))
      .sort((a, b) => b.sent - a.sent);
  }, [filtered, data]);

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

  async function setJobReason(job, reason, reasonType) {
    // Optimistic update
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.uuid === job.uuid
          ? { ...j, assignedReason: reason || undefined, assignedReasonType: reason ? reasonType : undefined }
          : j,
      ),
    }));
    try {
      const res = reason
        ? await fetch('/api/qmt/reasons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: job.uuid, reason, reasonType }),
          })
        : await fetch(`/api/qmt/reasons?uuid=${job.uuid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // Rollback
      setData((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.uuid === job.uuid
            ? { ...j, assignedReason: job.assignedReason, assignedReasonType: job.assignedReasonType }
            : j,
        ),
      }));
      alert(`Failed to save reason: ${e.message}`);
    }
  }

  async function toggleExclude(job) {
    const willExclude = !job.userExcluded;
    // Optimistic update — flip the flag locally so UI responds instantly.
    setData((prev) => ({
      ...prev,
      jobs: prev.jobs.map((j) =>
        j.uuid === job.uuid
          ? { ...j, userExcluded: willExclude, excludedFromKpis: j.atCost || willExclude }
          : j,
      ),
    }));
    try {
      const res = willExclude
        ? await fetch('/api/qmt/excluded', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: job.uuid, reason: '' }),
          })
        : await fetch(`/api/qmt/excluded?uuid=${job.uuid}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      // Rollback on failure
      setData((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.uuid === job.uuid
            ? { ...j, userExcluded: !willExclude, excludedFromKpis: j.atCost || !willExclude }
            : j,
        ),
      }));
      alert(`Failed to update exclusion: ${e.message}`);
    }
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
            onClick={() => load({ fresh: true })}
            disabled={loading}
            title="Force a fresh pull from ServiceM8 (bypasses cache)"
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
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
            <KpiCard
              label="Avg profit / hour"
              value={`${fmtPerHour(data.kpis.avgEstDollarsPerHour)} → ${fmtPerHour(data.kpis.avgActDollarsPerHour)}`}
              sub="Est → Actual (GP Ex Lab ÷ hours)"
              tone={
                data.kpis.avgActDollarsPerHour >= 100
                  ? 'good'
                  : data.kpis.avgActDollarsPerHour >= 50
                  ? ''
                  : 'warn'
              }
            />
          </div>

          <AnalysisWindow
            summary={summary}
            viewMode={viewMode}
            setViewMode={setViewMode}
            targets={data.targets || { incLabour: 0.425, exLabour: 0.593 }}
            filterCaption={buildFilterCaption({
              data,
              filter,
              range,
              testMode,
              count: filtered.length,
              excludedCount: filtered.filter((j) => j.excludedFromKpis).length,
            })}
          />

          <ByJobTypeTable rows={byJobType} />

          <ReasonsBreakdown filtered={filtered} />

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
            <button
              type="button"
              onClick={() => setFilter({ ...filter, excludedOnly: !filter.excludedOnly })}
              title="Show only jobs excluded from KPIs (*_atcost or manually toggled)"
              className={`rounded-md border px-3 py-1 text-[12px] transition-colors ${
                filter.excludedOnly
                  ? 'border-pm-red bg-pm-red-bg text-pm-red'
                  : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
              }`}
            >
              {filter.excludedOnly ? '⊘ Excluded only' : '⊘ Excluded'}
            </button>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, belowDphTarget: !filter.belowDphTarget })}
              title="Show only jobs whose $/hr is below the type's target"
              className={`rounded-md border px-3 py-1 text-[12px] transition-colors ${
                filter.belowDphTarget
                  ? 'border-pm-red bg-pm-red-bg text-pm-red'
                  : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
              }`}
            >
              {filter.belowDphTarget ? '▼ Below $/hr only' : '▼ Below $/hr'}
            </button>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, belowMarginTarget: !filter.belowMarginTarget })}
              title="Show only jobs whose margin is below the type's Inc-Lab target"
              className={`rounded-md border px-3 py-1 text-[12px] transition-colors ${
                filter.belowMarginTarget
                  ? 'border-pm-red bg-pm-red-bg text-pm-red'
                  : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
              }`}
            >
              {filter.belowMarginTarget ? '▼ Below M% target' : '▼ Below M% target'}
            </button>
            <button
              type="button"
              onClick={() => setFilter({ ...filter, belowQuotedMargin: !filter.belowQuotedMargin })}
              title="Show only Completed jobs whose actual margin came in below estimated"
              className={`rounded-md border px-3 py-1 text-[12px] transition-colors ${
                filter.belowQuotedMargin
                  ? 'border-pm-red bg-pm-red-bg text-pm-red'
                  : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
              }`}
            >
              {filter.belowQuotedMargin ? '△ Below quoted M%' : '△ Below quoted M%'}
            </button>
            <span className="text-[11px] text-pm-text-3">Showing {filtered.length}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-pm-border bg-pm-surface">
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                <tr className="border-b border-pm-border bg-pm-bg/50">
                  <th colSpan={5} className="px-3 py-1.5"></th>
                  <th colSpan={3} className="px-3 py-1.5 text-center font-medium border-l border-pm-border bg-pm-orange-bg/30">Estimated</th>
                  <th colSpan={3} className="px-3 py-1.5 text-center font-medium border-l border-pm-border bg-pm-green-bg/20">Actual</th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
                  <th className="px-3 py-1.5"></th>
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
                  <th className="px-3 py-2 font-medium text-right border-l border-pm-border">M% Δ</th>
                  <th className="px-3 py-2 font-medium text-right border-l border-pm-border">$/hr</th>
                  <th className="px-3 py-2 font-medium text-center" title="Reason (variance / loss)">📝</th>
                  <th className="px-3 py-2 font-medium text-right" title="Exclude from KPIs">⊘</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-4 py-10 text-center text-sm text-pm-text-3">
                      No jobs match your filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((j) => {
                    const delta =
                      j.actual && j.estimated
                        ? j.actual.marginIncLabour - j.estimated.marginIncLabour
                        : null;
                    return (
                      <tr
                        key={j.uuid}
                        onClick={() => setOpenJobUuid(j.uuid)}
                        className={`cursor-pointer border-b border-pm-border last:border-b-0 hover:bg-pm-orange-bg/30 ${
                          j.userExcluded ? 'opacity-50 line-through decoration-pm-text-3/50' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 font-mono text-[11px] text-pm-text-3">{fmtDate(j.date)}</td>
                        <td className="px-3 py-1.5 font-mono text-[11px] text-pm-orange">
                          {j.jobNumber || j.po || '—'}
                          {j.atCost && (
                            <span className="ml-1 rounded bg-pm-ocean/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-pm-ocean no-underline">
                              At cost
                            </span>
                          )}
                        </td>
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
                            <div className="text-[9px] text-pm-text-3 no-underline">inv {fmtMoney(j.estimated.invoice)}</div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-pm-text-3">{fmtMoney(j.estimated.totalCost)}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${marginToneCls(j.estimated.marginIncLabour)}`}>
                          {fmtPct(j.estimated.marginIncLabour)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono border-l border-pm-border">{j.actual ? fmtMoney(j.actual.totalRevenue) : '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-pm-text-3">{j.actual ? fmtMoney(j.actual.totalCost) : '—'}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${j.actual ? marginToneCls(j.actual.marginIncLabour) : 'text-pm-text-3'}`}>
                          {j.actual ? (
                            (() => {
                              const globalInc = data?.targets?.incLabour ?? 0.425;
                              const typeT = data?.jobTypes?.find((t) => t.tag === j.jobType);
                              const tgt = Number.isFinite(typeT?.targetInc) ? typeT.targetInc : globalInc;
                              const belowTarget = j.actual.marginIncLabour < tgt;
                              const belowQuoted =
                                j.estimated && j.actual.marginIncLabour < j.estimated.marginIncLabour;
                              return (
                                <span>
                                  {belowQuoted && (
                                    <span title={`Below quoted (${fmtPct(j.estimated.marginIncLabour)})`}>△ </span>
                                  )}
                                  {belowTarget && (
                                    <span title={`Below target (${fmtPct(tgt)})`}>▼ </span>
                                  )}
                                  {fmtPct(j.actual.marginIncLabour)}
                                </span>
                              );
                            })()
                          ) : (
                            '—'
                          )}
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-mono border-l border-pm-border ${
                            delta === null ? 'text-pm-text-3' : delta >= 0 ? 'text-pm-green' : 'text-pm-red'
                          }`}
                        >
                          {delta === null ? '—' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono border-l border-pm-border">
                          {(() => {
                            const side = j.actual || j.estimated;
                            const dph = side?.dollarsPerHour;
                            if (dph === null || dph === undefined) return '—';
                            const globalDph = data?.targets?.dollarsPerHour ?? 150;
                            const typeT = data?.jobTypes?.find((t) => t.tag === j.jobType);
                            const tgt = Number.isFinite(typeT?.targetDollarsPerHour)
                              ? typeT.targetDollarsPerHour
                              : globalDph;
                            const below = dph < tgt;
                            return (
                              <span className={below ? 'text-pm-red' : 'text-pm-text'}>
                                {below && <span title={`Below target ${fmtPerHour(tgt)}`}>▼ </span>}
                                {fmtPerHour(dph)}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-1.5">
                          <ReasonCell
                            job={j}
                            varianceCauses={data.varianceCauses || []}
                            lossReasons={data.lossReasons || []}
                            onChange={(reason, type) => setJobReason(j, reason, type)}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleExclude(j); }}
                            title={j.userExcluded ? 'Click to include' : 'Exclude from KPIs'}
                            className={`rounded px-1.5 py-0.5 text-[11px] no-underline ${
                              j.userExcluded
                                ? 'bg-pm-red-bg text-pm-red'
                                : 'text-pm-text-3 hover:bg-pm-surface-2 hover:text-pm-text'
                            }`}
                          >
                            {j.userExcluded ? '✗' : '⊘'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
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
        <JobDetailDrawer
          uuid={openJobUuid}
          job={data?.jobs?.find((j) => j.uuid === openJobUuid)}
          varianceCauses={data?.varianceCauses || []}
          lossReasons={data?.lossReasons || []}
          onReasonChange={(reason, type) => {
            const job = data?.jobs?.find((j) => j.uuid === openJobUuid);
            if (job) setJobReason(job, reason, type);
          }}
          onClose={() => setOpenJobUuid(null)}
        />
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

function ReasonCell({ job, varianceCauses, lossReasons, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const ctx = reasonContextFor(job);
  if (!ctx) return <span className="text-pm-text-3">—</span>;

  const options = ctx === 'variance' ? varianceCauses : lossReasons;
  const current = job.assignedReason;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title={current ? `${current} (click to change)` : 'Add reason'}
        className={`rounded px-1.5 py-0.5 text-[11px] no-underline ${
          current
            ? ctx === 'variance'
              ? 'bg-pm-red-bg text-pm-red'
              : 'bg-pm-ocean/15 text-pm-ocean'
            : 'text-pm-text-3 hover:bg-pm-surface-2 hover:text-pm-text'
        }`}
      >
        {current ? truncate(current, 22) : '+ Add'}
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-64 overflow-y-auto rounded-md border border-pm-border bg-pm-surface shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-pm-border px-3 py-1.5 font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-pm-text-3">
            {ctx === 'variance' ? 'Variance cause' : 'Loss reason'}
          </div>
          {options.length === 0 && (
            <div className="px-3 py-2 text-[11px] italic text-pm-text-3">
              No options — add some in Settings
            </div>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt, ctx); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left text-[12px] hover:bg-pm-surface-2 ${
                current === opt ? 'text-pm-orange font-medium' : 'text-pm-text'
              }`}
            >
              {opt}
            </button>
          ))}
          {current && (
            <button
              type="button"
              onClick={() => { onChange(null, ctx); setOpen(false); }}
              className="block w-full border-t border-pm-border px-3 py-1.5 text-left text-[11px] text-pm-text-3 hover:bg-pm-surface-2 hover:text-pm-text"
            >
              Clear reason
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function ReasonsBreakdown({ filtered }) {
  const variance = useMemo(() => {
    const buckets = new Map();
    filtered.forEach((p) => {
      if (p.status !== 'Completed') return;
      if (!p.actual || !p.estimated) return;
      if (p.actual.marginIncLabour >= p.estimated.marginIncLabour) return;
      const reason = p.assignedReason && p.assignedReasonType === 'variance'
        ? p.assignedReason
        : 'Unassigned';
      const shortfall = p.estimated.gpIncLabour - p.actual.gpIncLabour;
      if (!buckets.has(reason)) buckets.set(reason, { reason, count: 0, shortfall: 0 });
      const b = buckets.get(reason);
      b.count += 1;
      b.shortfall += shortfall;
    });
    return Array.from(buckets.values()).sort((a, b) => b.shortfall - a.shortfall);
  }, [filtered]);

  const loss = useMemo(() => {
    const buckets = new Map();
    filtered.forEach((p) => {
      if (p.status !== 'Unsuccessful') return;
      const reason = p.assignedReason && p.assignedReasonType === 'loss'
        ? p.assignedReason
        : 'Unassigned';
      const value = p.estimated?.totalRevenue || 0;
      if (!buckets.has(reason)) buckets.set(reason, { reason, count: 0, value: 0 });
      const b = buckets.get(reason);
      b.count += 1;
      b.value += value;
    });
    return Array.from(buckets.values()).sort((a, b) => b.value - a.value);
  }, [filtered]);

  if (variance.length === 0 && loss.length === 0) return null;

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
      {variance.length > 0 && (
        <div className="rounded-lg border border-pm-border bg-pm-surface overflow-hidden">
          <div className="border-b border-pm-border px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-red">
            Why margins slipped — Completed
          </div>
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
              <tr className="border-b border-pm-border">
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium text-right">Jobs</th>
                <th className="px-3 py-2 font-medium text-right">$ Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {variance.map((r) => (
                <tr key={r.reason} className="border-b border-pm-border last:border-b-0">
                  <td className="px-3 py-2">
                    {r.reason === 'Unassigned' ? (
                      <span className="italic text-pm-text-3">Unassigned</span>
                    ) : (
                      r.reason
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono text-pm-red">
                    {r.shortfall.toLocaleString('en-AU', {
                      style: 'currency',
                      currency: 'AUD',
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loss.length > 0 && (
        <div className="rounded-lg border border-pm-border bg-pm-surface overflow-hidden">
          <div className="border-b border-pm-border px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-ocean">
            Why we lost quotes — Unsuccessful
          </div>
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
              <tr className="border-b border-pm-border">
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium text-right">Jobs</th>
                <th className="px-3 py-2 font-medium text-right">Value lost</th>
              </tr>
            </thead>
            <tbody>
              {loss.map((r) => (
                <tr key={r.reason} className="border-b border-pm-border last:border-b-0">
                  <td className="px-3 py-2">
                    {r.reason === 'Unassigned' ? (
                      <span className="italic text-pm-text-3">Unassigned</span>
                    ) : (
                      r.reason
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.value.toLocaleString('en-AU', {
                      style: 'currency',
                      currency: 'AUD',
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ByJobTypeTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const totals = rows.reduce(
    (acc, r) => {
      acc.sent += r.sent;
      acc.won += r.won;
      acc.lost += r.lost;
      acc.estRevenue += r.estRevenue;
      acc.estGpInc += r.estGpInc;
      acc.estGpEx += r.estGpEx;
      acc.estHours += r.estHours;
      acc.actRevenue += r.actRevenue;
      acc.actGpInc += r.actGpInc;
      acc.actGpEx += r.actGpEx;
      acc.actHours += r.actHours;
      return acc;
    },
    { sent: 0, won: 0, lost: 0, estRevenue: 0, estGpInc: 0, estGpEx: 0, estHours: 0, actRevenue: 0, actGpInc: 0, actGpEx: 0, actHours: 0 },
  );
  const totalDecided = totals.won + totals.lost;
  const total = {
    label: 'Total',
    ...totals,
    decided: totalDecided,
    winRatio: totalDecided > 0 ? totals.won / totalDecided : null,
    estMarginInc: totals.estRevenue > 0 ? totals.estGpInc / totals.estRevenue : null,
    actMarginInc: totals.actRevenue > 0 ? totals.actGpInc / totals.actRevenue : null,
    estDollarsPerHour: totals.estHours > 0 ? totals.estGpEx / totals.estHours : null,
    actDollarsPerHour: totals.actHours > 0 ? totals.actGpEx / totals.actHours : null,
  };

  const cellMargin = (m) =>
    m === null || m === undefined ? '—' : `${(m * 100).toFixed(1)}%`;
  const cellMoneyHr = (n) =>
    n === null || n === undefined
      ? '—'
      : `${n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}/hr`;

  const renderRow = (r, isTotal = false) => (
    <tr
      key={r.tag || 'total'}
      className={
        isTotal
          ? 'border-t-2 border-pm-border bg-pm-bg/30 font-medium'
          : 'border-b border-pm-border last:border-b-0'
      }
    >
      <td className="px-3 py-2">{r.label}</td>
      <td className="px-3 py-2 text-right font-mono">{r.sent}</td>
      <td className="px-3 py-2 text-right font-mono text-pm-green">{r.won}</td>
      <td className="px-3 py-2 text-right font-mono text-pm-red">{r.lost}</td>
      <td className="px-3 py-2 text-right font-mono">
        {r.winRatio === null ? '—' : `${(r.winRatio * 100).toFixed(0)}%`}
      </td>
      <td className="px-3 py-2 text-right font-mono border-l border-pm-border text-pm-text-3">
        {cellMargin(r.estMarginInc)}
      </td>
      <td className="px-3 py-2 text-right font-mono">{cellMargin(r.actMarginInc)}</td>
      <td className="px-3 py-2 text-right font-mono border-l border-pm-border text-pm-text-3">
        {cellMoneyHr(r.estDollarsPerHour)}
      </td>
      <td className="px-3 py-2 text-right font-mono">{cellMoneyHr(r.actDollarsPerHour)}</td>
    </tr>
  );

  return (
    <div className="mb-6 rounded-lg border border-pm-border bg-pm-surface overflow-x-auto">
      <div className="border-b border-pm-border px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-orange">
        By job type — quotes sent
      </div>
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
          <tr className="border-b border-pm-border">
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium text-right">Sent</th>
            <th className="px-3 py-2 font-medium text-right">Won</th>
            <th className="px-3 py-2 font-medium text-right">Lost</th>
            <th className="px-3 py-2 font-medium text-right">Win %</th>
            <th className="px-3 py-2 font-medium text-right border-l border-pm-border">Est M%</th>
            <th className="px-3 py-2 font-medium text-right">Act M%</th>
            <th className="px-3 py-2 font-medium text-right border-l border-pm-border">Est $/hr</th>
            <th className="px-3 py-2 font-medium text-right">Act $/hr</th>
          </tr>
        </thead>
        <tbody>{rows.map((r) => renderRow(r))}</tbody>
        <tfoot>{renderRow(total, true)}</tfoot>
      </table>
    </div>
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

function buildFilterCaption({ data, filter, range, testMode, count, excludedCount }) {
  const parts = [];
  if (testMode) parts.push('Test mode (*_test)');
  parts.push(`${count} job${count === 1 ? '' : 's'}`);
  if (excludedCount > 0 && !filter.excludedOnly) parts.push(`${excludedCount} excluded`);
  if (filter.excludedOnly) parts.push('Excluded only');
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

  // Build display rows per status + Total. Targets are revenue-weighted from
  // the per-job-type targets; falls back to global if a type has none set.
  const rowFor = (b) => {
    const hasActuals = b.status === 'Work Order' || b.status === 'Completed' || b.status === 'Total';
    if (isActual && !hasActuals) {
      return {
        ...b,
        revenueShown: null,
        gpInc: null,
        gpEx: null,
        mInc: null,
        mEx: null,
        targetInc: null,
        targetEx: null,
        dollarsPerHour: null,
        targetDollarsPerHour: null,
        hasActuals,
        showActual: false,
      };
    }
    const showActual = isActual && hasActuals;
    const denom = showActual ? b.actRevenue : b.revenue;
    const gpInc = showActual ? b.gpIncAct : b.gpIncEst;
    const gpEx = showActual ? b.gpExAct : b.gpExEst;
    const hours = showActual ? b.actHours : b.estHours;
    const mInc = denom > 0 ? gpInc / denom : null;
    const mEx = denom > 0 ? gpEx / denom : null;
    const tIncSum = showActual ? b.twActIncSum : b.twIncSum;
    const tExSum = showActual ? b.twActExSum : b.twExSum;
    const tDphSum = showActual ? b.twDphActSum : b.twDphEstSum;
    const targetInc = denom > 0 ? tIncSum / denom : (targets?.incLabour ?? null);
    const targetEx = denom > 0 ? tExSum / denom : (targets?.exLabour ?? null);
    const targetDollarsPerHour = hours > 0 ? tDphSum / hours : (targets?.dollarsPerHour ?? null);
    const dollarsPerHour = hours > 0 ? gpEx / hours : null;
    return { ...b, revenueShown: denom, gpInc, gpEx, mInc, mEx, targetInc, targetEx, dollarsPerHour, targetDollarsPerHour, hasActuals, showActual };
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
              <th className="px-3 py-2 font-medium text-right border-l border-pm-border">Target $/hr</th>
              <th className="px-3 py-2 font-medium text-right">$/hr</th>
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
  // Per-row weighted target falls back to global if missing
  const tInc = r.targetInc ?? targets.incLabour;
  const tEx = r.targetEx ?? targets.exLabour;
  const vInc = variance(r.mInc, tInc);
  const vEx = variance(r.mEx, tEx);
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
      <td className="px-3 py-2 text-right font-mono text-pm-text-3">{tInc === null ? '—' : fmtPct(tInc)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.mInc === null ? '—' : fmtMoney(r.gpInc)}</td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mInc, tInc)}`}>
        {r.mInc === null ? '—' : (
          <span>
            {fmtPct(r.mInc)} <span className={`text-[10px] ${vClass(vInc)}`}>{vTxt(vInc)}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-pm-text-3 border-l border-pm-border">{tEx === null ? '—' : fmtPct(tEx)}</td>
      <td className="px-3 py-2 text-right font-mono">{r.mEx === null ? '—' : fmtMoney(r.gpEx)}</td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mEx, tEx)}`}>
        {r.mEx === null ? '—' : (
          <span>
            {fmtPct(r.mEx)} <span className={`text-[10px] ${vClass(vEx)}`}>{vTxt(vEx)}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-pm-text-3 border-l border-pm-border">
        {r.targetDollarsPerHour === null ? '—' : fmtPerHour(r.targetDollarsPerHour)}
      </td>
      <td
        className={`px-3 py-2 text-right font-mono ${
          r.dollarsPerHour === null
            ? 'text-pm-text-3'
            : r.dollarsPerHour >= (r.targetDollarsPerHour ?? 0)
            ? 'text-pm-green'
            : 'text-pm-red'
        }`}
      >
        {r.dollarsPerHour === null ? (
          '—'
        ) : (
          <span>
            {fmtPerHour(r.dollarsPerHour)}
            {r.targetDollarsPerHour !== null && (
              <span className={`ml-1 text-[10px] ${r.dollarsPerHour >= r.targetDollarsPerHour ? 'text-pm-green' : 'text-pm-red'}`}>
                {r.dollarsPerHour - r.targetDollarsPerHour >= 0 ? '+' : ''}
                {fmtPerHour(r.dollarsPerHour - r.targetDollarsPerHour)}
              </span>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

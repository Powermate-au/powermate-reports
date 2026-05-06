'use client';

import { fmtMoney, fmtPct, fmtPerHour, statusToneCls, marginToneCls } from './format';

// Per-status Summary Analysis matching the Excel layout. Includes a
// revenue/hours-weighted Target column for each metric and an
// Estimated ↔ Actual toggle.
export default function AnalysisWindow({ summary, viewMode, setViewMode, targets, filterCaption }) {
  const isActual = viewMode === 'actual';
  const variance = (margin, target) =>
    margin === null || margin === undefined ? null : margin - target;

  const rows = summary.rows.map((b) => rowFor(b, isActual, targets));
  const totalRow = rowFor(summary.total, isActual, targets);

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

// Build display-ready row from a raw bucket. Targets are revenue-weighted
// from the per-job-type targets accumulated upstream; falls back to the
// global target if a type has none set. In Actual view, Quote/Unsuccessful
// rows show — rather than silently falling back to estimated.
function rowFor(b, isActual, targets) {
  const hasActuals =
    b.status === 'Work Order' || b.status === 'Completed' || b.status === 'Total';
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
  const targetInc = denom > 0 ? tIncSum / denom : targets?.incLabour ?? null;
  const targetEx = denom > 0 ? tExSum / denom : targets?.exLabour ?? null;
  const targetDollarsPerHour = hours > 0 ? tDphSum / hours : targets?.dollarsPerHour ?? null;
  const dollarsPerHour = hours > 0 ? gpEx / hours : null;
  return {
    ...b,
    revenueShown: denom,
    gpInc,
    gpEx,
    mInc,
    mEx,
    targetInc,
    targetEx,
    dollarsPerHour,
    targetDollarsPerHour,
    hasActuals,
    showActual,
  };
}

function AnalysisRow({ r, targets, variance, isTotal }) {
  const tInc = r.targetInc ?? targets.incLabour;
  const tEx = r.targetEx ?? targets.exLabour;
  const vInc = variance(r.mInc, tInc);
  const vEx = variance(r.mEx, tEx);
  const cls = isTotal
    ? 'border-t-2 border-pm-border bg-pm-bg/30 font-medium'
    : 'border-b border-pm-border last:border-b-0';
  const vClass = (v) =>
    v === null || v === undefined ? 'text-pm-text-3' : v >= 0 ? 'text-pm-green' : 'text-pm-red';
  const vTxt = (v) =>
    v === null || v === undefined ? '' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
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
      <td className="px-3 py-2 text-right font-mono text-pm-text-3">
        {tInc === null ? '—' : fmtPct(tInc)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {r.mInc === null ? '—' : fmtMoney(r.gpInc)}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mInc, tInc)}`}>
        {r.mInc === null ? (
          '—'
        ) : (
          <span>
            {fmtPct(r.mInc)} <span className={`text-[10px] ${vClass(vInc)}`}>{vTxt(vInc)}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono text-pm-text-3 border-l border-pm-border">
        {tEx === null ? '—' : fmtPct(tEx)}
      </td>
      <td className="px-3 py-2 text-right font-mono">
        {r.mEx === null ? '—' : fmtMoney(r.gpEx)}
      </td>
      <td className={`px-3 py-2 text-right font-mono ${marginToneCls(r.mEx, tEx)}`}>
        {r.mEx === null ? (
          '—'
        ) : (
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
              <span
                className={`ml-1 text-[10px] ${
                  r.dollarsPerHour >= r.targetDollarsPerHour ? 'text-pm-green' : 'text-pm-red'
                }`}
              >
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

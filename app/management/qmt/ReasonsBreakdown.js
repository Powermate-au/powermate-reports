'use client';

import { useMemo } from 'react';

// Aggregates assigned reasons across the filtered job list and shows two
// side-by-side mini tables: variance causes (Completed, negative variance)
// and loss reasons (Unsuccessful). Returns null if neither has any rows.
export default function ReasonsBreakdown({ filtered }) {
  const variance = useMemo(() => {
    const buckets = new Map();
    filtered.forEach((p) => {
      if (p.status !== 'Completed') return;
      if (!p.actual || !p.estimated) return;
      if (p.actual.marginIncLabour >= p.estimated.marginIncLabour) return;
      const reason =
        p.assignedReason && p.assignedReasonType === 'variance'
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
      const reason =
        p.assignedReason && p.assignedReasonType === 'loss' ? p.assignedReason : 'Unassigned';
      const value = p.estimated?.totalRevenue || 0;
      if (!buckets.has(reason)) buckets.set(reason, { reason, count: 0, value: 0 });
      const b = buckets.get(reason);
      b.count += 1;
      b.value += value;
    });
    return Array.from(buckets.values()).sort((a, b) => b.value - a.value);
  }, [filtered]);

  if (variance.length === 0 && loss.length === 0) return null;

  const fmtAud = (n) =>
    n.toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    });

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
                  <td className="px-3 py-2 text-right font-mono text-pm-red">{fmtAud(r.shortfall)}</td>
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
                  <td className="px-3 py-2 text-right font-mono">{fmtAud(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

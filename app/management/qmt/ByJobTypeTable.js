'use client';

import { fmtPct, fmtPerHour } from './format';

const fmtMargin = (m) => fmtPct(m);

// Per-job-type breakdown using SM8's quote_sent flag for win/loss accuracy.
// Sorted by Sent count desc; Total row at the bottom.
export default function ByJobTypeTable({ rows }) {
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
    {
      sent: 0,
      won: 0,
      lost: 0,
      estRevenue: 0,
      estGpInc: 0,
      estGpEx: 0,
      estHours: 0,
      actRevenue: 0,
      actGpInc: 0,
      actGpEx: 0,
      actHours: 0,
    },
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
        {fmtMargin(r.estMarginInc)}
      </td>
      <td className="px-3 py-2 text-right font-mono">{fmtMargin(r.actMarginInc)}</td>
      <td className="px-3 py-2 text-right font-mono border-l border-pm-border text-pm-text-3">
        {fmtPerHour(r.estDollarsPerHour)}
      </td>
      <td className="px-3 py-2 text-right font-mono">{fmtPerHour(r.actDollarsPerHour)}</td>
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

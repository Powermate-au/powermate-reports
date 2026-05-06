'use client';

export default function KpiCard({ label, value, sub, tone }) {
  const numCls =
    tone === 'good' ? 'text-pm-green' : tone === 'warn' ? 'text-pm-red' : 'text-pm-text';
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

'use client';

import { useEffect, useState } from 'react';

function fmtMoney(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: dp,
    minimumFractionDigits: dp,
  });
}

function fmtNum(n, dp = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-AU', { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

function fmtDateTime(s) {
  if (!s || s.startsWith('0000')) return '—';
  const d = new Date(s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d)) return s;
  return d.toLocaleString('en-AU', { hour12: false });
}

function kindBadge(kind) {
  switch (kind) {
    case 'labour':
      return <span className="rounded bg-pm-orange-bg px-1.5 py-0.5 text-[10px] font-medium uppercase text-pm-orange">Labour</span>;
    case 'stc':
    case 'bstc':
      return <span className="rounded bg-pm-ocean/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-pm-ocean">{kind.toUpperCase()}</span>;
    default:
      return <span className="rounded bg-pm-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase text-pm-text-2">Material</span>;
  }
}

export default function JobDetailDrawer({ uuid, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/qmt/job/${uuid}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
        return r.json();
      })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uuid]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog">
      <div className="absolute inset-0 bg-pm-navy/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-[900px] flex-col overflow-y-auto border-l border-pm-border bg-pm-bg shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-pm-border bg-pm-surface px-5 py-3">
          <div>
            <div className="font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-text-3">
              Job detail
            </div>
            {data && (
              <div className="text-[15px] font-medium text-pm-text">
                #{data.job.generated_job_id} · {data.job.customer || '—'}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-pm-border-2 px-3 py-1 text-[12px] text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text"
          >
            Close ✕
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-pm-text-3">
            <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-pm-border border-t-pm-orange" />
            Loading job detail…
          </div>
        ) : error ? (
          <div className="m-5 rounded-lg border border-pm-red-border bg-pm-red-bg p-4 text-[13px] text-pm-red">
            {error}
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5 px-5 py-5">
            {/* Job summary */}
            <section className="rounded-lg border border-pm-border bg-pm-surface p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                <Field label="Status" value={data.job.status} />
                <Field label="Date" value={fmtDateTime(data.job.date)} />
                <Field label="Total invoice (SM8)" value={fmtMoney(Number(data.job.total_invoice_amount))} />
                <Field label="Job type tag" value={data.job.job_description?.match(/\*_([a-z0-9]+)/i)?.[1] || '—'} />
              </div>
            </section>

            {/* Bundles */}
            <section>
              <div className="mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                Bundles ({data.bundles.length})
              </div>
              <p className="mb-3 text-[11px] text-pm-text-3">
                ServiceM8 keeps separate bundles for the quote snapshot vs current actuals. Lowest sort_order is usually the quote.
              </p>
              {data.bundles.map((b, idx) => (
                <div key={b.bundleUuid} className="mb-4 rounded-lg border border-pm-border bg-pm-surface p-4">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-medium text-pm-text">
                        {b.bundle?.name || (b.bundleUuid === '__loose' ? 'Loose items (no bundle)' : 'Bundle')}
                      </div>
                      <div className="font-mono text-[10px] text-pm-text-3">
                        {b.bundle?.item_number ? `${b.bundle.item_number} · ` : ''}
                        sort {b.bundle?.sort_order ?? '—'} · uuid {b.bundleUuid.slice(0, 8)}…
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        idx === 0 ? 'bg-pm-orange-bg text-pm-orange' : 'bg-pm-ocean/10 text-pm-ocean'
                      }`}
                    >
                      {idx === 0 ? 'Quote (assumed)' : 'Actual (assumed)'}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                        <tr className="border-b border-pm-border">
                          <th className="py-1.5 font-medium">Item</th>
                          <th className="py-1.5 font-medium text-right">Qty</th>
                          <th className="py-1.5 font-medium text-right">Unit price (ex GST)</th>
                          <th className="py-1.5 font-medium text-right">Unit cost</th>
                          <th className="py-1.5 font-medium text-right">Line revenue</th>
                          <th className="py-1.5 font-medium text-right">Line cost</th>
                          <th className="py-1.5 font-medium">Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.items.map((li) => (
                          <tr key={li.uuid} className="border-b border-pm-border/50 last:border-b-0">
                            <td className="py-1.5">
                              <div className="flex items-center gap-2">
                                {kindBadge(li._kind)}
                                <span className="text-pm-text">{li.name}</span>
                              </div>
                            </td>
                            <td className="py-1.5 text-right font-mono">{fmtNum(li._qty, 2)}</td>
                            <td className="py-1.5 text-right font-mono">{fmtMoney(li._unitPriceExGst)}</td>
                            <td className="py-1.5 text-right font-mono text-pm-text-3">{fmtMoney(li._unitCost)}</td>
                            <td className="py-1.5 text-right font-mono">{fmtMoney(li._lineRevenueEx)}</td>
                            <td className="py-1.5 text-right font-mono text-pm-text-3">{fmtMoney(li._lineCost)}</td>
                            <td className="py-1.5 text-[10px] text-pm-text-3">
                              {String(li.displayed_amount_is_tax_inclusive) === '1' ? 'Inc' : 'Ex'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="text-[11px] font-medium text-pm-text-2">
                        <tr className="border-t border-pm-border">
                          <td className="py-1.5">Materials</td>
                          <td colSpan={3} className="py-1.5"></td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(b.totals.materialsRevenue)}</td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(b.totals.materialsCost)}</td>
                          <td></td>
                        </tr>
                        <tr>
                          <td className="py-1.5">Labour</td>
                          <td colSpan={3}></td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(b.totals.labourRevenue)}</td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(b.totals.labourCost)}</td>
                          <td></td>
                        </tr>
                        {b.totals.stcRebate > 0 && (
                          <tr>
                            <td className="py-1.5">STC/BSTC rebate</td>
                            <td colSpan={3}></td>
                            <td className="py-1.5 text-right font-mono text-pm-ocean">−{fmtMoney(b.totals.stcRebate)}</td>
                            <td></td>
                            <td></td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}
            </section>

            {/* Activities */}
            <section className="rounded-lg border border-pm-border bg-pm-surface p-4">
              <div className="mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                Timesheet activities ({data.activities.length})
              </div>
              <p className="mb-3 text-[11px] text-pm-text-3">
                Actual hours worked × staff hourly cost rate gives true labour cost.
              </p>
              {data.activities.length === 0 ? (
                <div className="text-[12px] italic text-pm-text-3">No activities recorded.</div>
              ) : (
                <table className="w-full text-[11.5px]">
                  <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                    <tr className="border-b border-pm-border">
                      <th className="py-1.5 font-medium">Staff</th>
                      <th className="py-1.5 font-medium">Start</th>
                      <th className="py-1.5 font-medium">End</th>
                      <th className="py-1.5 font-medium text-right">Hours</th>
                      <th className="py-1.5 font-medium text-right">Cost rate</th>
                      <th className="py-1.5 font-medium text-right">Activity cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map((a) => (
                      <tr key={a.uuid} className="border-b border-pm-border/50 last:border-b-0">
                        <td className="py-1.5">{a._staffName || a.staff_uuid?.slice(0, 8) || '—'}</td>
                        <td className="py-1.5 font-mono text-[10px] text-pm-text-3">{fmtDateTime(a.start_date)}</td>
                        <td className="py-1.5 font-mono text-[10px] text-pm-text-3">{fmtDateTime(a.end_date)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtNum(a._hours, 2)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtMoney(a._hourlyCostRate)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtMoney(a._activityCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="text-[11px] font-medium text-pm-text-2">
                    <tr className="border-t border-pm-border">
                      <td colSpan={3} className="py-1.5">Total actual labour</td>
                      <td className="py-1.5 text-right font-mono">{fmtNum(data.derived.activityActualHours, 2)} h</td>
                      <td></td>
                      <td className="py-1.5 text-right font-mono">{fmtMoney(data.derived.activityActualLabourCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* Raw JSON expander */}
            <section className="rounded-lg border border-pm-border bg-pm-surface p-4">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-text-3 hover:text-pm-text"
              >
                {showRaw ? '▼' : '▶'} Raw API response
              </button>
              {showRaw && (
                <pre className="mt-3 max-h-[400px] overflow-auto rounded bg-pm-bg p-3 font-mono text-[10px] text-pm-text-2">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-pm-text-3">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-pm-text">{value || '—'}</div>
    </div>
  );
}

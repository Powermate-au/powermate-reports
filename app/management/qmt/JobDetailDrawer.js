'use client';

import { useEffect, useState } from 'react';

function fmtMoney(n, dp = 0) {
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

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDateTime(s) {
  if (!s || s.startsWith('0000')) return '—';
  const d = new Date(s.replace ? s.replace(' ', 'T') : s);
  if (isNaN(d)) return s;
  return d.toLocaleString('en-AU', { hour12: false });
}

function deltaCls(delta, goodDirection = 'up') {
  if (delta === 0) return 'text-pm-text-3';
  const positive = delta > 0;
  const isGood = goodDirection === 'up' ? positive : !positive;
  return isGood ? 'text-pm-green' : 'text-pm-red';
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
      <div className="relative flex h-full w-full max-w-[1000px] flex-col overflow-y-auto border-l border-pm-border bg-pm-bg shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-pm-border bg-pm-surface px-5 py-3">
          <div>
            <div className="font-condensed text-[11px] font-bold uppercase tracking-[0.1em] text-pm-text-3">
              QMT Profit Detail
            </div>
            {data && (
              <div className="text-[15px] font-medium text-pm-text">
                Job #{data.job.generated_job_id} · {data.job.customer || '—'}
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
                <Field label="Quote date" value={fmtDateTime(data.job.quote_date)} />
                <Field label="Work order date" value={fmtDateTime(data.job.work_order_date)} />
                <Field label="Completed" value={fmtDateTime(data.job.completion_date)} />
              </div>
            </section>

            {/* Est vs Actual side-by-side (QMT layout) */}
            <section className="rounded-lg border border-pm-border bg-pm-surface overflow-hidden">
              <div className="border-b border-pm-border px-4 py-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                {data.actual ? 'Estimated vs Actual' : 'Estimated (no actuals — job not started)'}
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-pm-border bg-pm-bg/50 text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-right font-medium">Time</th>
                    <th className="px-4 py-2 text-right font-medium border-l border-pm-border bg-pm-orange-bg/30">Est cost</th>
                    <th className="px-4 py-2 text-right font-medium border-l border-pm-border bg-pm-green-bg/20">Act cost</th>
                    <th className="px-4 py-2 text-right font-medium">Δ</th>
                    <th className="px-4 py-2 text-right font-medium border-l border-pm-border">Invoiced</th>
                    <th className="px-4 py-2 text-right font-medium">GP</th>
                    <th className="px-4 py-2 text-right font-medium">M%</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow
                    label="Labour"
                    estCost={data.estimated.labour.cost}
                    actCost={data.actual?.labour.cost}
                    estTime={`${fmtNum(data.estimated.labour.hours, 1)}h`}
                    actTime={data.actual ? `${fmtNum(data.actual.labour.hours, 1)}h` : null}
                    invoiced={data.estimated.labour.revenue}
                    deltaGoodDirection="down"
                  />
                  <ComparisonRow
                    label="Materials (real)"
                    estCost={data.estimated.materials.cost}
                    actCost={data.actual?.materials.cost}
                    invoiced={data.estimated.materials.revenue}
                    deltaGoodDirection="down"
                  />
                  {data.estimated.stcValue > 0 && (
                    <tr className="border-b border-pm-border last:border-b-0 text-pm-ocean">
                      <td className="px-4 py-2 font-medium">STC / BSTC rebate</td>
                      <td></td>
                      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">−{fmtMoney(data.estimated.stcValue)}</td>
                      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">−{fmtMoney(data.estimated.stcValue)}</td>
                      <td></td>
                      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">−{fmtMoney(data.estimated.stcValue)}</td>
                      <td colSpan={2} className="px-4 py-2 text-right text-[11px] text-pm-text-3">deducted from invoice</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-pm-border bg-pm-bg/30 font-medium">
                    <td className="px-4 py-2.5">Total</td>
                    <td></td>
                    <td className="px-4 py-2.5 text-right font-mono border-l border-pm-border">{fmtMoney(data.estimated.totalCost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono border-l border-pm-border">
                      {data.actual ? fmtMoney(data.actual.totalCost) : '—'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono ${data.actual ? deltaCls(data.actual.totalCost - data.estimated.totalCost, 'down') : 'text-pm-text-3'}`}>
                      {data.actual
                        ? `${data.actual.totalCost - data.estimated.totalCost > 0 ? '+' : ''}${fmtMoney(data.actual.totalCost - data.estimated.totalCost)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono border-l border-pm-border">
                      {fmtMoney((data.actual || data.estimated).totalRevenue)}
                      {data.estimated.stcValue > 0 && (
                        <div className="text-[10px] font-normal text-pm-text-3">
                          inv {fmtMoney((data.actual || data.estimated).invoice)} + STC {fmtMoney(data.estimated.stcValue)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className="text-pm-text-3">{fmtMoney(data.estimated.gpIncLabour)}</span>
                      {data.actual && (
                        <>
                          {' → '}
                          <span className="text-pm-text">{fmtMoney(data.actual.gpIncLabour)}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      <span className="text-pm-text-3">{fmtPct(data.estimated.marginIncLabour)}</span>
                      {data.actual && (
                        <>
                          {' → '}
                          <span className="text-pm-text">{fmtPct(data.actual.marginIncLabour)}</span>
                        </>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* Actual labour breakdown by staff */}
            {data.actual?.labour.breakdown?.length > 0 && (
              <section className="rounded-lg border border-pm-border bg-pm-surface p-4">
                <div className="mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                  Actual labour breakdown
                </div>
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                    <tr className="border-b border-pm-border">
                      <th className="py-1.5 font-medium">Staff</th>
                      <th className="py-1.5 font-medium">Material</th>
                      <th className="py-1.5 font-medium text-right">Hours</th>
                      <th className="py-1.5 font-medium text-right">Rate</th>
                      <th className="py-1.5 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.actual.labour.breakdown.map((b, i) => (
                      <tr key={i} className="border-b border-pm-border/50 last:border-b-0">
                        <td className="py-1.5">{b.staff}</td>
                        <td className="py-1.5 text-[11px] text-pm-text-3">{b.materialName}</td>
                        <td className="py-1.5 text-right font-mono">{fmtNum(b.hours, 2)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtMoney(b.rate, 2)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtMoney(b.cost, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="text-[11px] font-medium text-pm-text-2">
                    <tr className="border-t border-pm-border">
                      <td colSpan={2} className="py-1.5">Total</td>
                      <td className="py-1.5 text-right font-mono">{fmtNum(data.actual.labour.hours, 2)}</td>
                      <td></td>
                      <td className="py-1.5 text-right font-mono">{fmtMoney(data.actual.labour.cost, 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            )}

            {/* All recorded activities (audit trail) */}
            <section className="rounded-lg border border-pm-border bg-pm-surface p-4">
              <div className="mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                Time entries ({data.activities.length})
              </div>
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
                      <th className="py-1.5 font-medium">Type</th>
                      <th className="py-1.5 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map((a) => (
                      <tr key={a.uuid} className={`border-b border-pm-border/50 last:border-b-0 ${a.activity_was_recorded == 1 ? '' : 'opacity-50'}`}>
                        <td className="py-1.5">{a._staffName || '—'}</td>
                        <td className="py-1.5 font-mono text-[10px] text-pm-text-3">{fmtDateTime(a.start_date)}</td>
                        <td className="py-1.5 font-mono text-[10px] text-pm-text-3">{fmtDateTime(a.end_date)}</td>
                        <td className="py-1.5 text-right font-mono">{fmtNum(a._hours, 2)}</td>
                        <td className="py-1.5 text-[10px]">
                          {a.activity_was_recorded == 1 ? (
                            <span className="rounded bg-pm-green-bg px-1.5 py-0.5 text-pm-green">Recorded</span>
                          ) : a.activity_was_scheduled == 1 ? (
                            <span className="rounded bg-pm-surface-2 px-1.5 py-0.5 text-pm-text-3">Scheduled</span>
                          ) : (
                            <span className="text-pm-text-3">—</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right font-mono">{a._activityCost > 0 ? fmtMoney(a._activityCost, 2) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Bundles (raw line items) */}
            <section>
              <div className="mb-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
                Line items ({data.bundles.reduce((s, b) => s + b.items.length, 0)})
              </div>
              {data.bundles.map((b) => (
                <div key={b.bundleUuid} className="mb-3 rounded-lg border border-pm-border bg-pm-surface p-4">
                  <div className="mb-2 text-[12px] font-medium text-pm-text">
                    {b.bundle?.name || (b.bundleUuid === '__loose' ? 'Loose items (no bundle)' : 'Bundle')}
                  </div>
                  <table className="w-full text-[11.5px]">
                    <thead className="text-left text-[10px] uppercase tracking-[0.05em] text-pm-text-3">
                      <tr className="border-b border-pm-border">
                        <th className="py-1 font-medium">Item</th>
                        <th className="py-1 font-medium">Code</th>
                        <th className="py-1 font-medium text-right">Qty</th>
                        <th className="py-1 font-medium text-right">Unit cost</th>
                        <th className="py-1 font-medium text-right">Unit price</th>
                        <th className="py-1 font-medium text-right">Line cost</th>
                        <th className="py-1 font-medium text-right">Line revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((li) => (
                        <tr key={li.uuid} className="border-b border-pm-border/50 last:border-b-0">
                          <td className="py-1">{li.name}</td>
                          <td className="py-1 font-mono text-[10px] text-pm-text-3">{li._itemNumber}</td>
                          <td className="py-1 text-right font-mono">{fmtNum(li._qty, 2)}</td>
                          <td className="py-1 text-right font-mono text-pm-text-3">{fmtMoney(li._unitCost, 2)}</td>
                          <td className="py-1 text-right font-mono">{fmtMoney(li._unitPriceExGst, 2)}</td>
                          <td className="py-1 text-right font-mono text-pm-text-3">{fmtMoney(li._lineCost, 0)}</td>
                          <td className="py-1 text-right font-mono">{fmtMoney(li._lineRevenueEx, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            {/* Raw JSON */}
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

function ComparisonRow({ label, estTime, actTime, estCost, actCost, invoiced, deltaGoodDirection }) {
  const hasAct = actCost !== null && actCost !== undefined;
  const delta = hasAct ? actCost - (estCost ?? 0) : null;
  const costForGp = hasAct ? actCost : (estCost ?? 0);
  const gp = (invoiced ?? 0) - costForGp;
  const margin = invoiced > 0 ? gp / invoiced : 0;
  return (
    <tr className="border-b border-pm-border last:border-b-0">
      <td className="px-4 py-2 font-medium text-pm-text">{label}</td>
      <td className="px-4 py-2 text-right font-mono text-[11px] text-pm-text-3">
        {estTime || actTime ? `${estTime || '—'} / ${actTime || '—'}` : ''}
      </td>
      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">{fmtMoney(estCost)}</td>
      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">{hasAct ? fmtMoney(actCost) : '—'}</td>
      <td className={`px-4 py-2 text-right font-mono ${hasAct ? deltaCls(delta, deltaGoodDirection) : 'text-pm-text-3'}`}>
        {hasAct ? `${delta > 0 ? '+' : ''}${fmtMoney(delta)}` : '—'}
      </td>
      <td className="px-4 py-2 text-right font-mono border-l border-pm-border">{fmtMoney(invoiced)}</td>
      <td className="px-4 py-2 text-right font-mono">{fmtMoney(gp)}</td>
      <td className="px-4 py-2 text-right font-mono">{fmtPct(margin)}</td>
    </tr>
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

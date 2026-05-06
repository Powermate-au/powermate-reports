'use client';

import { isNeutralText as isNeutral } from '@/lib/neutral-text';

function ynNorm(v) {
  if (!v) return null;
  const s = v.toString().toLowerCase().trim();
  if (s === 'yes') return true;
  if (s === 'no') return false;
  return null;
}

function StatusDot({ state }) {
  const cls =
    state === true
      ? 'bg-pm-green'
      : state === false
      ? 'bg-pm-red'
      : 'bg-pm-border-2';
  return (
    <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />
  );
}

function CardTitle({ children, tone = 'orange' }) {
  const toneCls =
    tone === 'red'
      ? 'text-pm-red'
      : tone === 'green'
      ? 'text-pm-green'
      : 'text-pm-orange';
  return (
    <div
      className={`mb-3 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] ${toneCls}`}
    >
      {children}
    </div>
  );
}

function getQuestionList(staff) {
  // Daily questions only for the dashboard.
  return staff.dailyQuestions.filter((q) => !q.section);
}

function buildFlags(staff, row) {
  const flags = [];
  const questions = getQuestionList(staff);

  questions.forEach((q) => {
    const v = row[q.id];
    if (q.type === 'yesno' && ynNorm(v) === false) {
      const followUp = row[`${q.id}_followup`];
      flags.push({
        title: q.label,
        detail: followUp || 'No reason provided.',
      });
    }
    if (q.type === 'number' && Number(v) > 0 && q.id === 'warranty_open') {
      flags.push({
        title: `${v} open warranty claim${Number(v) === 1 ? '' : 's'}`,
        detail: row[`${q.id}_followup`] || '',
      });
    }
    if (q.type === 'number' && Number(v) > 0 && q.id === 'formbay_pending') {
      flags.push({
        title: `${v} STC / Formbay form${Number(v) === 1 ? '' : 's'} pending`,
        detail: row[`${q.id}_followup`] || '',
      });
    }
  });

  if (!isNeutral(row.help_needed)) {
    flags.push({
      title: 'Needs help',
      detail: row.help_needed,
    });
  }

  if (!row.priority_1?.trim() || !row.priority_2?.trim() || !row.priority_3?.trim()) {
    flags.push({
      title: 'Missing priorities for next workday',
      detail: 'One or more of the 3 priority items was not provided.',
    });
  }

  return flags;
}

export default function StaffPanel({ staff, row }) {
  if (!row) {
    return (
      <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-12 text-center">
        <div className="text-base font-medium text-pm-text-2">
          No submission found
        </div>
        <div className="mt-1 text-sm text-pm-text-3">
          No report from {staff.name} for this date.
        </div>
      </div>
    );
  }

  const questions = getQuestionList(staff);
  const flags = buildFlags(staff, row);
  const priorDone = ynNorm(row.priorities_done);
  const priorities = [row.priority_1, row.priority_2, row.priority_3].filter(
    (p) => p && p.toString().trim(),
  );

  const yesnoQs = questions.filter(
    (q) => q.type === 'yesno' && q.id !== 'priorities_done',
  );
  const numberQs = questions.filter((q) => q.type === 'number');
  const textQs = questions.filter(
    (q) =>
      (q.type === 'text' || q.type === 'detail') &&
      q.id !== 'help_needed' &&
      !isNeutral(row[q.id]),
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="col-span-full font-mono text-[11px] text-pm-text-3">
        Submitted: {row.timestamp || '—'}
      </div>

      {flags.length > 0 ? (
        <div className="col-span-full rounded-lg border border-pm-red-border bg-pm-red-bg p-5">
          <CardTitle tone="red">Flags — action required</CardTitle>
          <div className="flex flex-col">
            {flags.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-2 text-[13px] ${
                  i < flags.length - 1 ? 'border-b border-pm-red-border/50' : ''
                }`}
              >
                <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-pm-red" />
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-pm-red">
                    {f.title}
                  </div>
                  {f.detail && (
                    <div className="mt-0.5 text-pm-text">{f.detail}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="col-span-full rounded-lg border border-pm-green-border bg-pm-green-bg p-5">
          <CardTitle tone="green">All clear</CardTitle>
          <div className="flex items-center gap-2.5 text-sm font-medium text-pm-green">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-pm-green-border bg-white text-pm-green">
              ✓
            </span>
            No flags or issues today
          </div>
        </div>
      )}

      <div className="rounded-lg border border-pm-border bg-pm-surface p-5">
        <CardTitle>Previous priorities</CardTitle>
        <div
          className={`flex items-center gap-2.5 text-sm font-medium ${
            priorDone === true
              ? 'text-pm-green'
              : priorDone === false
              ? 'text-pm-red'
              : 'text-pm-text-3'
          }`}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border ${
              priorDone === true
                ? 'border-pm-green-border bg-pm-green-bg'
                : priorDone === false
                ? 'border-pm-red-border bg-pm-red-bg'
                : 'border-pm-border bg-pm-surface-2'
            }`}
          >
            {priorDone === true ? '✓' : priorDone === false ? '✗' : '?'}
          </span>
          {priorDone === true
            ? 'Completed all 3 priority items'
            : priorDone === false
            ? 'Did not complete priority items'
            : 'Not answered'}
        </div>
      </div>

      <div className="rounded-lg border border-pm-border bg-pm-surface p-5">
        <CardTitle>Next workday — 3 priorities</CardTitle>
        {priorities.length > 0 ? (
          <ol className="flex flex-col gap-1.5 text-[13px]">
            {priorities.slice(0, 3).map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pm-orange-bg font-mono text-[11px] font-semibold text-pm-orange">
                  {i + 1}
                </span>
                <span className="text-pm-text">{p}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-sm italic text-pm-text-3">Not provided</div>
        )}
      </div>

      {numberQs.map((q) => {
        const v = row[q.id];
        const fu = row[`${q.id}_followup`];
        return (
          <div
            key={q.id}
            className="rounded-lg border border-pm-border bg-pm-surface p-5"
          >
            <CardTitle>{q.label.replace(/\?$/, '')}</CardTitle>
            <div className="text-3xl font-semibold leading-none tracking-[-1px] text-pm-text">
              {v || '0'}
            </div>
            {fu && Number(v) > 0 && (
              <div className="mt-2 text-[12px] text-pm-text-2">{fu}</div>
            )}
          </div>
        );
      })}

      {yesnoQs.length > 0 && (
        <div className="col-span-full rounded-lg border border-pm-border bg-pm-surface p-5">
          <CardTitle>Checklist</CardTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {yesnoQs.map((q) => {
              const state = ynNorm(row[q.id]);
              const note =
                state === false ? row[`${q.id}_followup`] : '';
              return (
                <div
                  key={q.id}
                  className="flex items-start gap-2.5 border-b border-pm-border py-2 text-[12.5px] last:border-b-0"
                >
                  <StatusDot state={state} />
                  <div className="flex-1 leading-snug text-pm-text-2">
                    {q.label}
                    {note && (
                      <span className="mt-0.5 block text-[11px] italic text-pm-text-3">
                        {note}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {textQs.map((q) => (
        <div
          key={q.id}
          className="rounded-lg border border-pm-border bg-pm-surface p-5"
        >
          <CardTitle>{q.label.replace(/\?$/, '')}</CardTitle>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-pm-text">
            {row[q.id]}
          </div>
        </div>
      ))}
    </div>
  );
}

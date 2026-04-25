'use client';

import { useState, useEffect, useMemo } from 'react';
import { STAFF } from '@/lib/questions';
import QuestionCard from './QuestionCard';

function detectMode() {
  return new Date().getDay() === 5 ? 'weekly' : 'daily';
}

export default function ReportForm() {
  const [mode, setMode] = useState('daily');
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isFriday, setIsFriday] = useState(false);

  useEffect(() => {
    setIsFriday(new Date().getDay() === 5);
    setMode(detectMode());
  }, []);

  const selectedStaff = useMemo(
    () => STAFF.find((s) => s.id === selectedStaffId) || null,
    [selectedStaffId],
  );

  const questions = useMemo(() => {
    if (!selectedStaff) return [];
    return mode === 'weekly'
      ? selectedStaff.weeklyQuestions
      : selectedStaff.dailyQuestions;
  }, [selectedStaff, mode]);

  function handleSetMode(next) {
    if (next === mode) return;
    setMode(next);
    setSelectedStaffId(null);
    setValues({});
    setErrors({});
  }

  function handleSelectStaff(id) {
    setSelectedStaffId(id);
    setValues({});
    setErrors({});
  }

  function setFieldValue(key, val) {
    setValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      if (!(key in prev) && key !== 'priority_1' && key !== 'priority_2' && key !== 'priority_3') {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      if (key.startsWith('priority_')) delete next.priorities;
      return next;
    });
  }

  function validate() {
    const errs = {};
    questions.forEach((q) => {
      if (q.section || !q.required) return;

      if (q.type === 'priorities') {
        if (
          !values.priority_1?.trim() ||
          !values.priority_2?.trim() ||
          !values.priority_3?.trim()
        ) {
          errs.priorities = true;
        }
        return;
      }

      const v = values[q.id];
      const empty = v === undefined || v === null || v.toString().trim() === '';
      if (empty) errs[q.id] = true;

      if (q.followUp && q.type === 'yesno' && v === 'no') {
        const fu = values[`${q.id}_followup`];
        if (!fu || !fu.trim()) errs[`${q.id}_followup`] = true;
      }
      if (q.followUp && q.type === 'number' && Number(v) > 0) {
        const fu = values[`${q.id}_followup`];
        if (!fu || !fu.trim()) errs[`${q.id}_followup`] = true;
      }
    });
    return errs;
  }

  async function handleSubmit() {
    if (!selectedStaff) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Defer to next paint so the data-error attributes are applied first.
      requestAnimationFrame(() => {
        const first = document.querySelector('[data-error="true"]');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    setSubmitting(true);
    const payload = {
      timestamp: new Date().toLocaleString('en-AU'),
      staff_name: selectedStaff.name,
      staff_role: selectedStaff.role,
      form_type: mode,
      ...values,
    };

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitting(false);
      alert(`Submission failed: ${e.message}\n\nPlease check your connection and try again.`);
    }
  }

  function handleStartOver() {
    setSelectedStaffId(null);
    setValues({});
    setErrors({});
    setSubmitting(false);
    setSubmitted(false);
    setMode(detectMode());
  }

  const modeLabel = mode === 'weekly' ? 'Weekly wrap' : 'Daily report';
  const modeDesc =
    mode === 'weekly'
      ? 'Submit at the end of each Friday to wrap the week.'
      : 'Submit at the end of each workday, Monday to Thursday.';
  const toggleNote =
    mode === 'weekly'
      ? '(Friday wrap — or switch manually)'
      : isFriday
      ? '(Today is Friday — weekly wrap recommended)'
      : '';

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-center gap-2 px-4 sm:px-8 pt-5">
        <div className="inline-flex gap-0.5 rounded-full border border-pm-border bg-pm-surface p-1">
          <button
            type="button"
            onClick={() => handleSetMode('daily')}
            className={`rounded-full px-5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'daily'
                ? 'bg-pm-text text-white'
                : 'text-pm-text-2 hover:text-pm-text'
            }`}
          >
            Daily report
          </button>
          <button
            type="button"
            onClick={() => handleSetMode('weekly')}
            className={`rounded-full px-5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'weekly'
                ? 'bg-pm-text text-white'
                : 'text-pm-text-2 hover:text-pm-text'
            }`}
          >
            Weekly wrap
          </button>
        </div>
        {toggleNote && (
          <span className="hidden sm:inline font-mono text-[11px] text-pm-text-3">
            {toggleNote}
          </span>
        )}
      </div>

      <main className="mx-auto w-full max-w-[680px] px-3 sm:px-5 pb-20 pt-7">
        {submitted ? (
          <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-pm-green-border bg-pm-green-bg text-2xl text-pm-green">
              ✓
            </div>
            <h2 className="mb-2 text-xl font-semibold">Report submitted</h2>
            <p className="mb-5 text-sm text-pm-text-2">
              Thanks <strong className="font-medium text-pm-text">{selectedStaff?.name}</strong>.
              Your report has been recorded.
            </p>
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-md border border-pm-border-2 bg-transparent px-6 py-2.5 text-sm font-medium text-pm-text-2 transition-colors hover:bg-pm-surface-2 hover:text-pm-text"
            >
              Start a new report
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-lg bg-pm-navy px-6 py-6">
              <div
                className={`mb-2.5 inline-flex items-center gap-1.5 font-condensed text-[11px] font-bold uppercase tracking-[0.1em] ${
                  mode === 'weekly' ? 'text-pm-ocean' : 'text-pm-orange'
                }`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    mode === 'weekly' ? 'bg-pm-ocean' : 'bg-pm-orange'
                  }`}
                />
                {modeLabel}
              </div>
              <h1 className="font-condensed text-3xl font-extrabold uppercase leading-[1.15] tracking-[-0.3px] text-white">
                Staff Activity Report
              </h1>
              <p className="mt-1.5 text-[13px] text-white/55">{modeDesc}</p>
            </div>

            <div className="mb-5 rounded-lg border border-pm-border bg-pm-surface p-5">
              <div className="mb-2.5 font-condensed text-[11px] font-bold uppercase tracking-[0.09em] text-pm-text-3">
                Who are you?
              </div>
              <div className="flex flex-wrap gap-2">
                {STAFF.map((s) => {
                  const active = s.id === selectedStaffId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelectStaff(s.id)}
                      className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'border-pm-text bg-pm-text text-white'
                          : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {!selectedStaff ? (
              <div className="px-5 py-10 text-center text-sm text-pm-text-3">
                Select your name above to begin
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  {questions.map((q, idx) => {
                    if (q.section) {
                      return (
                        <div
                          key={`section-${idx}`}
                          className="flex items-center gap-2.5 pt-4 pb-2 font-condensed text-[11px] font-bold uppercase tracking-[0.12em] text-pm-orange"
                        >
                          {q.section}
                          <span className="h-px flex-1 bg-pm-border" />
                        </div>
                      );
                    }
                    return (
                      <QuestionCard
                        key={q.id || `q-${idx}`}
                        q={q}
                        values={values}
                        errors={errors}
                        onChange={setFieldValue}
                      />
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-pm-border bg-pm-surface px-6 py-5">
                  <div className="text-[13px] text-pm-text-2">
                    <strong className="block font-medium text-pm-text">
                      {selectedStaff.name}
                    </strong>
                    {modeLabel} · {new Date().toLocaleDateString('en-AU')}
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="rounded-md bg-pm-orange px-9 py-3 font-condensed text-[15px] font-bold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pm-orange-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-pm-border-2 w-full sm:w-auto"
                  >
                    {submitting ? 'Submitting…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

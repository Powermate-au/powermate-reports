'use client';

const labelCls = 'text-[11px] font-bold uppercase tracking-[0.09em] text-pm-text-3 font-condensed';

function FollowUp({ id, label, placeholder, value, onChange, hasError }) {
  return (
    <div className="mt-2.5 border-t border-pm-border pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-pm-red">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-pm-red" />
        {label}
      </div>
      <textarea
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-md border border-pm-border-2 bg-pm-bg px-3 py-2.5 text-sm text-pm-text outline-none transition-colors focus:border-pm-orange focus:bg-pm-surface resize-y"
      />
      {hasError && (
        <div className="mt-1.5 text-xs text-pm-red">
          Please provide the required details.
        </div>
      )}
    </div>
  );
}

export default function QuestionCard({
  q,
  values,
  errors,
  onChange,
}) {
  const value = values[q.id];
  const hasError = errors[q.id];
  const fuKey = `${q.id}_followup`;
  const fuValue = values[fuKey];
  const fuError = errors[fuKey];
  const cardErr = hasError || fuError;

  if (q.type === 'priorities') {
    const priErr = errors.priorities;
    return (
      <div
        data-error={priErr ? 'true' : undefined}
        className={`rounded-lg border bg-pm-surface p-4 sm:p-5 transition-colors ${
          priErr ? 'border-pm-red-border' : 'border-pm-border'
        }`}
      >
        <div className="mb-3 text-sm font-medium leading-snug text-pm-text">
          What are your 3 priority items for your next workday?
          <span className="ml-1 text-pm-orange">*</span>
          <span className="mt-1 block text-xs font-normal italic text-pm-text-2">
            Be specific and actionable. These will appear at the top of your next report.
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-start gap-2">
              <div className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pm-orange-bg text-[11px] font-semibold text-pm-orange font-condensed">
                {n}
              </div>
              <input
                type="text"
                value={values[`priority_${n}`] || ''}
                onChange={(e) => onChange(`priority_${n}`, e.target.value)}
                placeholder={
                  n === 1
                    ? 'e.g. Complete and send quote #7488 to Helen Haran'
                    : n === 2
                    ? 'e.g. Confirm crane booking for Vinnies job'
                    : 'e.g. Process Bernie Boral invoice'
                }
                className="w-full rounded-md border border-pm-border-2 bg-pm-bg px-3 py-2.5 text-sm text-pm-text outline-none transition-colors focus:border-pm-orange focus:bg-pm-surface"
              />
            </div>
          ))}
        </div>
        {priErr && (
          <div className="mt-2 text-xs text-pm-red">
            Please enter all 3 priority items.
          </div>
        )}
      </div>
    );
  }

  const labelBlock = (
    <div className="mb-3 text-sm font-medium leading-snug text-pm-text">
      {q.label}
      {q.required && <span className="ml-1 text-pm-orange">*</span>}
      {q.hint && (
        <span className="mt-1 block text-xs font-normal italic text-pm-text-2">
          {q.hint}
        </span>
      )}
    </div>
  );

  let body = null;

  if (q.type === 'yesno') {
    const yes = value === 'yes';
    const no = value === 'no';
    body = (
      <>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(q.id, 'yes')}
            className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
              yes
                ? 'border-pm-green-border bg-pm-green-bg text-pm-green'
                : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onChange(q.id, 'no')}
            className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors ${
              no
                ? 'border-pm-red-border bg-pm-red-bg text-pm-red'
                : 'border-pm-border-2 bg-pm-surface text-pm-text-2 hover:bg-pm-surface-2 hover:text-pm-text'
            }`}
          >
            No
          </button>
        </div>
        {q.followUp && no && (
          <FollowUp
            id={`fu-${q.id}`}
            label="If No — please explain (required)"
            placeholder={q.followUp}
            value={fuValue}
            onChange={(v) => onChange(fuKey, v)}
            hasError={fuError}
          />
        )}
      </>
    );
  } else if (q.type === 'number') {
    const num = Number(value);
    const showFu = !Number.isNaN(num) && num > 0;
    body = (
      <>
        <input
          type="number"
          min="0"
          value={value || ''}
          onChange={(e) => onChange(q.id, e.target.value)}
          placeholder="0"
          className="w-32 rounded-md border border-pm-border-2 bg-pm-bg px-3 py-2.5 text-sm text-pm-text outline-none transition-colors focus:border-pm-orange focus:bg-pm-surface"
        />
        {q.followUp && showFu && (
          <FollowUp
            id={`fu-${q.id}`}
            label="Please provide details (required if greater than 0)"
            placeholder={q.followUp}
            value={fuValue}
            onChange={(v) => onChange(fuKey, v)}
            hasError={fuError}
          />
        )}
      </>
    );
  } else {
    // text or detail
    body = (
      <textarea
        value={value || ''}
        onChange={(e) => onChange(q.id, e.target.value)}
        placeholder={q.hint || 'Your answer…'}
        rows={q.type === 'detail' ? 4 : 3}
        className="w-full rounded-md border border-pm-border-2 bg-pm-bg px-3 py-2.5 text-sm text-pm-text outline-none transition-colors focus:border-pm-orange focus:bg-pm-surface resize-y min-h-[88px]"
      />
    );
  }

  return (
    <div
      data-error={cardErr ? 'true' : undefined}
      className={`rounded-lg border bg-pm-surface p-4 sm:p-5 transition-colors ${
        cardErr ? 'border-pm-red-border' : 'border-pm-border'
      }`}
    >
      {labelBlock}
      {body}
      {hasError && !fuError && (
        <div className="mt-2 text-xs text-pm-red">This field is required.</div>
      )}
    </div>
  );
}

export { labelCls };

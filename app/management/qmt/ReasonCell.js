'use client';

import { useEffect, useRef, useState } from 'react';
import { reasonContextFor } from './format';

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Per-row reason picker shown on the master jobs table.
// - Empty for jobs that don't need a reason
// - Shows "+ Add" when a reason is needed but not yet assigned
// - Shows the assigned reason as a coloured chip otherwise
// Click opens a popover with the appropriate list (variance vs loss).
export default function ReasonCell({ job, varianceCauses, lossReasons, onChange }) {
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
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
              onClick={() => {
                onChange(opt, ctx);
                setOpen(false);
              }}
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
              onClick={() => {
                onChange(null, ctx);
                setOpen(false);
              }}
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

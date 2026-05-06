'use client';

import { useEffect, useRef, useState } from 'react';

// Generic checkbox-list dropdown for multi-select filters.
// `options` is [{ value, label }]. `selected` is an array of value strings.
export default function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function toggle(v) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  const summary =
    selected.length === 0 ? `All ${label.toLowerCase()}` : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-md border bg-pm-surface px-3 py-1 text-[12px] text-pm-text transition-colors ${
          selected.length > 0 ? 'border-pm-orange text-pm-orange' : 'border-pm-border-2'
        }`}
      >
        {summary} ▾
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-pm-border bg-pm-surface shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="block w-full border-b border-pm-border px-3 py-1.5 text-left text-[11px] text-pm-text-3 hover:bg-pm-surface-2 hover:text-pm-text"
            >
              Clear all
            </button>
          )}
          {options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[12px] text-pm-text hover:bg-pm-surface-2"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="accent-pm-orange"
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const CODE = process.env.NEXT_PUBLIC_PASSCODE || 'powermate';

export default function PasscodeGate({ children }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUnlocked(localStorage.getItem('pm-auth') === '1');
    setReady(true);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === CODE) {
      localStorage.setItem('pm-auth', '1');
      setUnlocked(true);
    } else {
      setError(true);
      setInput('');
    }
  }

  if (!ready) return null;
  if (unlocked) return children;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-pm-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pm-navy">
            <Image
              src="/Powermate-(Icon)(White).png"
              alt="Powermate"
              width={1200}
              height={1049}
              className="h-9 w-auto"
            />
          </div>
          <div className="text-center">
            <div className="font-condensed text-xl font-bold uppercase tracking-[0.05em] text-pm-text">
              Powermate
            </div>
            <div className="text-sm text-pm-text-3">Staff Reports</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-pm-border bg-pm-surface p-6 shadow-sm"
        >
          <label className="mb-1.5 block text-[13px] font-medium text-pm-text-2">
            Passcode
          </label>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="Enter passcode"
            autoFocus
            className={`w-full rounded-md border px-3 py-2.5 text-sm outline-none transition-colors ${
              error
                ? 'border-pm-red bg-pm-red-bg text-pm-red placeholder:text-pm-red/50'
                : 'border-pm-border-2 bg-pm-bg text-pm-text focus:border-pm-orange'
            }`}
          />
          {error && (
            <p className="mt-1.5 text-[12px] text-pm-red">Incorrect passcode. Try again.</p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-md bg-pm-orange py-2.5 font-condensed text-[15px] font-bold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pm-orange-hover"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

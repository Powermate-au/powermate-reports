'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

const STAFF_CODE = process.env.NEXT_PUBLIC_STAFF_PASSCODE || 'powermate';
const MGMT_CODE = process.env.NEXT_PUBLIC_MGMT_PASSCODE || 'powermate-mgmt';

export default function PasscodeGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const requiresMgmt = pathname.startsWith('/management');

  const [role, setRole] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('pm-auth');
    setRole(stored === 'staff' || stored === 'management' ? stored : null);
    setReady(true);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === MGMT_CODE) {
      localStorage.setItem('pm-auth', 'management');
      setRole('management');
      setInput('');
    } else if (input === STAFF_CODE && !requiresMgmt) {
      localStorage.setItem('pm-auth', 'staff');
      setRole('staff');
      setInput('');
    } else {
      setError(true);
      setInput('');
    }
  }

  function handleSwitch() {
    localStorage.removeItem('pm-auth');
    setRole(null);
    router.push('/');
  }

  if (!ready) return null;

  const hasAccess =
    role === 'management' || (role === 'staff' && !requiresMgmt);

  if (!hasAccess) {
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
              <div className="text-sm text-pm-text-3">
                {requiresMgmt ? 'Management area' : 'Staff Reports'}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-pm-border bg-pm-surface p-6 shadow-sm"
          >
            <label className="mb-1.5 block text-[13px] font-medium text-pm-text-2">
              {requiresMgmt ? 'Management passcode' : 'Passcode'}
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
              <p className="mt-1.5 text-[12px] text-pm-red">
                {requiresMgmt
                  ? 'Incorrect management passcode.'
                  : 'Incorrect passcode. Try again.'}
              </p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-md bg-pm-orange py-2.5 font-condensed text-[15px] font-bold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pm-orange-hover"
            >
              Unlock
            </button>
            {role === 'staff' && requiresMgmt && (
              <button
                type="button"
                onClick={() => router.push('/staff')}
                className="mt-3 w-full text-[12px] text-pm-text-3 hover:text-pm-text"
              >
                ← Back to staff portal
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        type="button"
        onClick={handleSwitch}
        title="Sign out"
        className="fixed bottom-3 right-3 z-50 rounded-md border border-pm-border-2 bg-pm-surface/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-pm-text-3 backdrop-blur transition-colors hover:bg-pm-surface hover:text-pm-text"
      >
        Sign out
      </button>
    </>
  );
}

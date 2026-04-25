'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_JOB_TYPES, DEFAULT_ROOT_CAUSES, TAG_PREFIX } from '@/lib/qmt-config';

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

export default function SettingsClient() {
  const [jobTypes, setJobTypes] = useState([]);
  const [rootCauses, setRootCauses] = useState([]);
  const [newType, setNewType] = useState({ tag: '', label: '' });
  const [newCause, setNewCause] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setJobTypes(data.jobTypes?.length ? data.jobTypes : DEFAULT_JOB_TYPES);
        setRootCauses(data.rootCauses?.length ? data.rootCauses : DEFAULT_ROOT_CAUSES);
      } catch (e) {
        setError(e.message);
        setJobTypes(DEFAULT_JOB_TYPES);
        setRootCauses(DEFAULT_ROOT_CAUSES);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function addJobType() {
    const tag = slugify(newType.tag || newType.label);
    const label = newType.label.trim() || tag;
    if (!tag) return;
    if (jobTypes.some((t) => t.tag === tag)) return;
    setJobTypes([...jobTypes, { tag, label }]);
    setNewType({ tag: '', label: '' });
  }

  function removeJobType(tag) {
    setJobTypes(jobTypes.filter((t) => t.tag !== tag));
  }

  function updateJobTypeLabel(tag, label) {
    setJobTypes(jobTypes.map((t) => (t.tag === tag ? { ...t, label } : t)));
  }

  function addRootCause() {
    const v = newCause.trim();
    if (!v || rootCauses.includes(v)) return;
    setRootCauses([...rootCauses, v]);
    setNewCause('');
  }

  function removeRootCause(c) {
    setRootCauses(rootCauses.filter((x) => x !== c));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTypes, rootCauses }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `HTTP ${res.status}`);
      }
      setSavedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-4 sm:px-8 py-7">
      <div className="mb-5">
        <h1 className="font-condensed text-2xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
          Settings
        </h1>
        <p className="mt-1 text-sm text-pm-text-2">
          Manage QMT job type tags and root causes. Changes save to the Google Sheet
          and apply immediately — no redeploy needed.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-12 text-center text-sm text-pm-text-3">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-pm-border border-t-pm-orange" />
          Loading settings…
        </div>
      ) : (
        <>
          <section className="mb-5 rounded-lg border border-pm-border bg-pm-surface p-5">
            <div className="mb-1 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
              Job type tags
            </div>
            <p className="mb-3 text-[12px] text-pm-text-3">
              Tags are matched against ServiceM8 job descriptions in the format{' '}
              <code className="rounded bg-pm-surface-2 px-1 py-0.5 text-[11px]">
                {TAG_PREFIX}tag
              </code>{' '}
              (e.g. <code className="rounded bg-pm-surface-2 px-1 py-0.5 text-[11px]">{TAG_PREFIX}solar</code>).
            </p>

            <div className="flex flex-col gap-1.5">
              {jobTypes.map((t) => (
                <div key={t.tag} className="flex items-center gap-2 rounded-md border border-pm-border bg-pm-bg px-3 py-2">
                  <code className="min-w-[110px] font-mono text-[12px] text-pm-orange">
                    {TAG_PREFIX}{t.tag}
                  </code>
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => updateJobTypeLabel(t.tag, e.target.value)}
                    className="flex-1 rounded border border-pm-border-2 bg-pm-surface px-2 py-1 text-[13px] text-pm-text outline-none focus:border-pm-orange"
                  />
                  <button
                    type="button"
                    onClick={() => removeJobType(t.tag)}
                    className="rounded border border-pm-border-2 px-2 py-1 text-[11px] text-pm-text-3 hover:border-pm-red hover:text-pm-red"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-pm-border pt-3">
              <input
                type="text"
                placeholder="Display name (e.g. Heat Pump)"
                value={newType.label}
                onChange={(e) => setNewType({ ...newType, label: e.target.value })}
                className="flex-1 min-w-[180px] rounded border border-pm-border-2 bg-pm-surface px-2 py-1.5 text-[13px] text-pm-text outline-none focus:border-pm-orange"
              />
              <input
                type="text"
                placeholder="tag (auto)"
                value={newType.tag}
                onChange={(e) => setNewType({ ...newType, tag: e.target.value })}
                className="w-[140px] rounded border border-pm-border-2 bg-pm-surface px-2 py-1.5 font-mono text-[12px] text-pm-text outline-none focus:border-pm-orange"
              />
              <button
                type="button"
                onClick={addJobType}
                className="rounded-md bg-pm-orange px-4 py-1.5 text-[13px] font-medium text-white hover:bg-pm-orange-hover"
              >
                Add
              </button>
            </div>
          </section>

          <section className="mb-5 rounded-lg border border-pm-border bg-pm-surface p-5">
            <div className="mb-1 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-pm-orange">
              Root causes
            </div>
            <p className="mb-3 text-[12px] text-pm-text-3">
              Used to categorise variance on completed jobs where actual margin is below quote.
            </p>

            <div className="flex flex-col gap-1.5">
              {rootCauses.map((c) => (
                <div key={c} className="flex items-center gap-2 rounded-md border border-pm-border bg-pm-bg px-3 py-2">
                  <span className="flex-1 text-[13px] text-pm-text">{c}</span>
                  <button
                    type="button"
                    onClick={() => removeRootCause(c)}
                    className="rounded border border-pm-border-2 px-2 py-1 text-[11px] text-pm-text-3 hover:border-pm-red hover:text-pm-red"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-pm-border pt-3">
              <input
                type="text"
                placeholder="New root cause"
                value={newCause}
                onChange={(e) => setNewCause(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRootCause())}
                className="flex-1 min-w-[180px] rounded border border-pm-border-2 bg-pm-surface px-2 py-1.5 text-[13px] text-pm-text outline-none focus:border-pm-orange"
              />
              <button
                type="button"
                onClick={addRootCause}
                className="rounded-md bg-pm-orange px-4 py-1.5 text-[13px] font-medium text-white hover:bg-pm-orange-hover"
              >
                Add
              </button>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 sm:-mx-8 border-t border-pm-border bg-pm-bg/95 px-4 sm:px-8 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-pm-text-3">
                {error
                  ? `Error: ${error}`
                  : savedAt
                  ? `Saved ${savedAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Unsaved changes are kept locally until you click Save.'}
              </span>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-md bg-pm-orange px-6 py-2 font-condensed text-[14px] font-bold uppercase tracking-[0.05em] text-white transition-colors hover:bg-pm-orange-hover disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

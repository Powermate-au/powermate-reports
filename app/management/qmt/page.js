export default function QmtPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 sm:px-8 py-7">
      <div className="mb-5 flex items-baseline justify-between">
        <h1 className="font-condensed text-2xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
          Quoted Margin Tracker
        </h1>
      </div>

      <div className="rounded-lg border border-pm-border bg-pm-surface px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pm-orange-bg text-2xl text-pm-orange">
          ⏳
        </div>
        <h2 className="mb-1 font-condensed text-lg font-bold uppercase tracking-[0.05em] text-pm-text">
          Coming next
        </h2>
        <p className="text-sm text-pm-text-2">
          ServiceM8 integration and the full QMT will go live in Phase 2.
        </p>
        <p className="mt-3 text-[12px] text-pm-text-3">
          Make sure your job type tags are set up in{' '}
          <a href="/management/settings" className="text-pm-orange hover:underline">
            Settings
          </a>{' '}
          before then.
        </p>
      </div>
    </main>
  );
}

import Link from 'next/link';

const TILES = [
  {
    href: '/staff/reports',
    title: 'Daily / Weekly Report',
    desc: 'Submit your end-of-day or end-of-week report.',
  },
];

export default function StaffPortal() {
  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-4 sm:px-8 py-10">
      <h1 className="mb-1 font-condensed text-3xl font-extrabold uppercase tracking-[-0.3px] text-pm-text">
        Staff Portal
      </h1>
      <p className="mb-8 text-sm text-pm-text-2">Choose a tool to get started.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-pm-border bg-pm-surface p-6 transition-colors hover:border-pm-orange hover:bg-pm-surface-2"
          >
            <div className="font-condensed text-lg font-bold uppercase tracking-[0.05em] text-pm-text group-hover:text-pm-orange">
              {t.title}
            </div>
            <div className="mt-1 text-sm text-pm-text-2">{t.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}

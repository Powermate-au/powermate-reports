import Link from 'next/link';
import Image from 'next/image';
import ManagementNav from './ManagementNav';

export default function ManagementLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b-[3px] border-pm-orange bg-pm-navy">
        <div className="flex h-15 items-center justify-between px-4 sm:px-8 py-3">
          <Link href="/management" className="flex items-center gap-3">
            <Image
              src="/Powermate-(Icon)(White).png"
              alt="Powermate"
              width={1200}
              height={1049}
              priority
              className="h-9 w-auto"
            />
            <span className="font-condensed text-base sm:text-lg font-bold uppercase tracking-[0.08em] text-white">
              Powermate
            </span>
            <div className="hidden sm:block ml-1 h-6 w-px bg-white/20" />
            <span className="hidden sm:inline font-condensed text-sm font-bold uppercase tracking-[0.08em] text-white/70">
              Management
            </span>
          </Link>
          <ManagementNav />
        </div>
      </header>
      {children}
    </div>
  );
}

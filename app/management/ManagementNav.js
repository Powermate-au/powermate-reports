'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/management/dashboard', label: 'Reports' },
  { href: '/management/qmt', label: 'QMT' },
  { href: '/management/settings', label: 'Settings' },
];

export default function ManagementNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-[12px] font-medium uppercase tracking-[0.05em] transition-colors ${
              active
                ? 'bg-pm-orange text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

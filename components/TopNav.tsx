'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const NAV = [
  { href: '/', label: 'Deploy' },
  { href: '/positions', label: 'Positions' },
  { href: '/activity', label: 'Activity' },
];

export default function TopNav() {
  const pathname = usePathname() ?? '/';
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight text-white"
          >
            FlowX
          </Link>
          <nav className="flex items-center gap-6">
            {NAV.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'text-sm transition',
                    active ? 'text-white' : 'text-white/40 hover:text-white/80',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {mounted ? (
          <ConnectButton
            accountStatus="address"
            chainStatus="none"
            showBalance={false}
          />
        ) : (
          <div
            aria-hidden
            className="h-9 w-[140px] rounded-xl bg-white/5"
          />
        )}
      </div>
    </header>
  );
}

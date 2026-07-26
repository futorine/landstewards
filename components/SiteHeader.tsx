'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLand } from './LandStateProvider';

/** Wordmark + roster nav + demo reset, shared across all three routes. */
export default function SiteHeader() {
  const { state, reset } = useLand();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/', label: 'Stewards' },
    { href: '/register', label: 'Register' },
    { href: '/admin', label: 'Admin' },
  ];

  function handleReset() {
    // Restores the seeded roster (in-memory). Does not touch anything on-chain.
    reset();
    router.push('/');
  }

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-ink/20 pb-5">
      <Link href="/" className="group">
        <p className="font-mono text-[10px] font-bold uppercase tracking-plate text-foil">
          {state.project.displayName}
        </p>
        <h1 className="font-display text-2xl font-black uppercase tracking-[0.06em] group-hover:text-foil sm:text-3xl">
          Landstewards
        </h1>
      </Link>

      <nav className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
        {links.map((l) => {
          const active =
            l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={[
                'rounded-md border px-3 py-1.5 transition-colors',
                active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/30 text-ink hover:bg-ink hover:text-paper',
              ].join(' ')}
            >
              {l.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={handleReset}
          title="Reset the demo roster to its seeded state (local only — nothing on-chain changes)"
          className="rounded-md border border-refuse/40 px-3 py-1.5 text-refuse transition-colors hover:bg-refuse hover:text-paper"
        >
          Reset
        </button>
      </nav>
    </header>
  );
}

'use client';

import Link from 'next/link';
import { useLand } from '@/components/LandStateProvider';
import { attestedStewards, pendingStewards, slotsFilled } from '@/lib/mock/land';
import SiteHeader from '@/components/SiteHeader';
import StewardCircle from '@/components/StewardCircle';
import StewardCard from '@/components/StewardCard';
import EvidencePanel from '@/components/EvidencePanel';

export default function StewardsOverview() {
  const { state } = useLand();
  const { project } = state;
  const filled = slotsFilled(state);
  const attested = attestedStewards(state);
  const pending = pendingStewards(state);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <SiteHeader />

      {/* Hero: the land, the ring, the stewards */}
      <section className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-plate text-foil">
            {project.location} · {project.hectares} ha
          </p>
          <h2 className="mt-3 font-display text-4xl font-black uppercase leading-[0.95] tracking-[0.04em] sm:text-5xl">
            {project.displayName}
          </h2>
          <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-ink/85">
            {project.mandate}
          </p>

          <dl className="mt-6 grid max-w-md grid-cols-3 gap-3">
            <Stat label="Slots filled" value={`${filled}/${project.maxSlots}`} tone="admit" />
            <Stat label="Attested" value={String(attested.length)} tone="admit" />
            <Stat label="In process" value={String(pending.length)} tone="refuse" />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper"
            >
              Register as a steward
            </Link>
          </div>
        </div>

        <StewardCircle state={state} />
      </section>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-admit" />
          Attested · inside the ring · holds a slot subname
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-refuse" />
          In process · outside · awaiting attestation
        </span>
      </div>

      {/* Roster */}
      <section className="mt-10">
        <h3 className="font-display text-sm font-black uppercase tracking-plate">
          The roster
        </h3>
        <p className="mt-2 max-w-2xl text-sm font-medium text-ink/80">
          Every steward, seated or waiting. Each stewardship slot is an ENS
          subname of {project.ensName} whose record points at the steward&rsquo;s
          own ENS name — reassignable when people leave or join.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {state.stewards.map((s) => (
            <StewardCard key={s.id} steward={s} state={state} />
          ))}
        </div>
      </section>

      {state.log.length > 0 && (
        <section className="mt-10 rounded-2xl border border-ink/20 bg-paper p-6">
          <h3 className="font-display text-sm font-black uppercase tracking-plate">
            Registry log
          </h3>
          <ol className="mt-4 space-y-3">
            {state.log
              .slice()
              .reverse()
              .map((entry, i) => (
                <li
                  key={i}
                  className="flex gap-4 border-b border-ink/10 pb-3 last:border-0"
                >
                  <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55">
                    {entry.actor}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-semibold text-ink/85">
                      {entry.action}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-ink">
                      {entry.detail}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      )}

      <div className="mt-10">
        <EvidencePanel />
      </div>

      <footer className="mt-10 border-t border-ink/20 pt-5">
        <p className="font-mono text-[10px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-ink/60">
          Roster and attestation are simulated in this harness. Slot subname
          records are written for real on ENS (Sepolia), signed by a Privy
          embedded wallet. Don&rsquo;t trust us. Verify us.
        </p>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'admit' | 'refuse';
}) {
  return (
    <div className="rounded-lg border border-ink/15 bg-paper/70 px-3 py-2">
      <dd
        className={[
          'font-display text-2xl font-black tabular-nums',
          tone === 'admit' ? 'text-admit' : 'text-refuse',
        ].join(' ')}
      >
        {value}
      </dd>
      <dt className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink/60">
        {label}
      </dt>
    </div>
  );
}

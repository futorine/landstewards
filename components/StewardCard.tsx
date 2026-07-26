'use client';

import Link from 'next/link';
import { slotForSteward, slotSubname, type LandState, type Steward } from '@/lib/mock/land';
import PersonIcon from './PersonIcon';
import EnsTag from './EnsTag';

/**
 * One steward in the roster grid. Green (attested, holds a slot) or red
 * (pending). Links through to the individual profile.
 */
export default function StewardCard({
  steward,
  state,
}: {
  steward: Steward;
  state: LandState;
}) {
  const attested = steward.status === 'attested';
  const slot = slotForSteward(state, steward.id);

  return (
    <Link
      href={`/stewards/${steward.id}`}
      className="group relative block rounded-2xl border border-ink/15 bg-paper/70 p-5 transition-colors hover:border-ink/35"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={[
              'flex shrink-0 items-center justify-center rounded-full border p-2',
              attested
                ? 'border-admit/60 bg-admit/15 text-admit'
                : 'border-refuse/60 bg-refuse/15 text-refuse',
            ].join(' ')}
          >
            <PersonIcon size={22} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold">
              {steward.displayName}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-[11px] font-semibold text-ink/65">
              {steward.ensName}
              <EnsTag />
            </p>
          </div>
        </div>

        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em]',
            attested ? 'bg-admit/15 text-admit' : 'bg-refuse/15 text-refuse',
          ].join(' ')}
        >
          {attested ? 'Attested' : 'Pending'}
        </span>
      </div>

      <div className="mt-4 border-t border-dashed border-ink/15 pt-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
          {steward.role}
        </p>
        {attested && slot ? (
          <p className="mt-1 truncate font-mono text-[11px] font-medium text-ink/70">
            Holds {slotSubname(state.project, slot.index)}
          </p>
        ) : (
          <p className="mt-1 font-mono text-[11px] font-medium text-ink/55">
            Awaiting attestation &amp; a slot
          </p>
        )}
      </div>
    </Link>
  );
}

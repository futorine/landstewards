'use client';

import { isEligible, ensText } from '@/lib/mock/chain';
import type { ChainState } from '@/lib/mock/types';
import EnsTag from './EnsTag';

/**
 * The machine-readable zone from the bottom of a passport data page.
 * Real MRZ is fixed-width with `<` as filler, so it makes an honest place
 * to encode live state: the last field flips between ADMIT and REFUS.
 */

const LINE_LENGTH = 44;

function pad(value: string): string {
  return value.slice(0, LINE_LENGTH).padEnd(LINE_LENGTH, '<');
}

export default function MrzStrip({ state }: { state: ChainState }) {
  const admitted = isEligible(state);

  const line1 = pad(
    `P<PKN${state.ensName.replace(/\./g, '<').toUpperCase()}<<`
  );
  const line2 = pad(
    `${state.identity.slice(2, 14).toUpperCase()}<P${state.policy.id}<${
      admitted ? 'ADMIT' : 'REFUS'
    }<${ensText(state, 'status')}`
  );

  return (
    <div className="border-t-2 border-ink/25 bg-paper px-6 py-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        Machine-readable zone
        <EnsTag />
      </p>
      <pre
        aria-label={`Machine readable zone, currently reading ${
          admitted ? 'admitted' : 'refused'
        }`}
        className="mt-2 overflow-x-auto font-mono text-[11px] font-semibold leading-relaxed tracking-[0.12em] text-ink sm:text-sm"
      >
        {line1}
        {'\n'}
        {line2}
      </pre>
    </div>
  );
}

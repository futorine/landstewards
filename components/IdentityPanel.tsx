'use client';

import { isClaimValid } from '@/lib/mock/chain';
import type { ChainState, ClaimTopic } from '@/lib/mock/types';
import EnsTag from './EnsTag';

const FIELD_ORDER: ClaimTopic[] = ['personhood', 'kyc', 'accredited'];

function Field({
  label,
  value,
  tag,
}: {
  label: string;
  value: string;
  tag?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        {label}
        {tag}
      </dt>
      <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default function IdentityPanel({ state }: { state: ChainState }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink/20 bg-paper">
      <div className="absolute inset-0 guilloche opacity-[0.08]" aria-hidden />

      <div className="relative p-6">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink/20 pb-3">
          <h2 className="font-display text-sm font-black uppercase tracking-plate">
            Holder
          </h2>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
            Simulated
          </span>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Wallet" value={state.wallet} />
          <Field label="Identity" value={state.identity} />
          <Field label="ENS name" value={state.ensName} tag={<EnsTag />} />
          <Field label="Policy" value={`#${state.policy.id} · ${state.policy.requires.join(' + ')}`} />
        </dl>

        <h3 className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
          Claims held
        </h3>

        <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
          {FIELD_ORDER.map((topic) => {
            const claim = state.claims[topic];
            const valid = isClaimValid(state, topic);
            const required = state.policy.requires.includes(topic);
            const revoked = state.revoked[topic];

            return (
              <li key={topic} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold">
                    {claim.label}
                    {required && (
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-foil">
                        Required
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] font-medium text-ink/60">
                    {claim.attester === 'real'
                      ? 'World ID attester'
                      : 'Labelled mock attester'}
                    {' · '}
                    {claim.dataHash.slice(0, 14)}…
                  </p>
                </div>

                <span
                  className={[
                    'shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em]',
                    valid ? 'text-admit' : revoked ? 'text-refuse' : 'text-ink/55',
                  ].join(' ')}
                >
                  {valid ? 'Valid' : revoked ? 'Revoked' : 'Not held'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

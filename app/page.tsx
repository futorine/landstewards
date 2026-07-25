'use client';

import { useState } from 'react';
import {
  initialState,
  addClaim,
  revokeClaim,
  reinstateClaim,
  isEligible,
  isClaimValid,
  readSurfaces,
  failingClaims,
} from '@/lib/mock/chain';
import type { ChainState, ClaimTopic, LogEntry } from '@/lib/mock/types';
import IdentityPanel from '@/components/IdentityPanel';
import SurfaceCard from '@/components/SurfaceCard';
import Controls from '@/components/Controls';
import MrzStrip from '@/components/MrzStrip';
import EvidencePanel from '@/components/EvidencePanel';
import ClaimProgress from '@/components/ClaimProgress';

export default function Page() {
  const [state, setState] = useState<ChainState>(initialState);
  const [log, setLog] = useState<LogEntry[]>([]);
  /** Bumped on every state change so the stamps re-slam. */
  const [generation, setGeneration] = useState(0);

  function apply(
    next: ChainState,
    entry: Omit<LogEntry, 'at' | 'eligibleAfter'>
  ) {
    setState(next);
    setLog((prev) => [
      ...prev,
      { ...entry, at: new Date().toISOString(), eligibleAfter: isEligible(next) },
    ]);
    setGeneration((g) => g + 1);
  }

  function handleSubmitClaim(topic: ClaimTopic) {
    apply(addClaim(state, topic), {
      actor: 'holder',
      action: 'identity.addClaim',
      detail: `Holder submitted the ${state.claims[topic].label} claim signed by the issuer.`,
    });
  }

  function handleRevoke(topic: ClaimTopic) {
    apply(revokeClaim(state, topic), {
      actor: 'issuer',
      action: 'claimIssuer.revokeClaim',
      detail: `Issuer revoked ${state.claims[topic].label} on its own contract. The identity was not touched.`,
    });
  }

  function handleReinstate(topic: ClaimTopic) {
    apply(reinstateClaim(state, topic), {
      actor: 'issuer',
      action: 'claimIssuer.reinstateClaim',
      detail: `Issuer reinstated ${state.claims[topic].label}.`,
    });
  }

  function handleReset() {
    setState(initialState());
    setLog([]);
    setGeneration((g) => g + 1);
  }

  const surfaces = readSurfaces(state);
  const admitted = isEligible(state);
  const failing = failingClaims(state);
  const validRequired = state.policy.requires.filter((topic) =>
    isClaimValid(state, topic)
  ).length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      {/* Cover: foil-block heading, the way a passport front reads. */}
      <header className="overflow-hidden rounded-2xl border-2 border-ink">
        <div className="relative overflow-hidden bg-paper px-6 py-10 text-ink sm:px-10 sm:py-14">
          <div className="absolute inset-0 guilloche opacity-[0.08]" aria-hidden />
          <div className="relative">
            <p className="font-mono text-[10px] font-bold uppercase tracking-plate text-foil">
              Eligibility control
            </p>
            <h1 className="mt-4 font-display text-4xl font-black uppercase leading-[0.95] tracking-[0.06em] sm:text-6xl">
              ZK Credential
              <br />
              Attestor
            </h1>
            <p className="mt-6 max-w-xl text-sm font-medium leading-relaxed text-ink/85 sm:text-base">
              One identity, one question any contract can ask. Grant the claims,
              watch four surfaces open. Revoke one claim and watch all four shut —
              from a single write the issuer makes to its own contract.
            </p>
          </div>
        </div>

        {/* The live verdict, stated once, large. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-ink bg-paper px-6 py-5 sm:px-10">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
              gate.isEligible(identity, {state.policy.id})
            </p>
            <p
              className={[
                'mt-1 font-display text-3xl font-black uppercase tracking-[0.1em]',
                admitted ? 'text-admit' : 'text-refuse',
              ].join(' ')}
            >
              {admitted ? 'Green' : 'Red'}
            </p>
          </div>
          <p className="max-w-xs text-xs font-medium leading-relaxed text-ink/75">
            {admitted
              ? 'All required claims valid. Every surface is passing traffic.'
              : `Missing or revoked: ${failing
                  .map((t) => state.claims[t].label.toLowerCase())
                  .join(', ')}.`}
          </p>
        </div>

        <MrzStrip state={state} />
      </header>

      <div className="mt-8 flex justify-center">
        <ClaimProgress
          current={validRequired}
          total={state.policy.requires.length}
          eligible={admitted}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <IdentityPanel state={state} />
        <Controls
          state={state}
          onSubmitClaim={handleSubmitClaim}
          onRevoke={handleRevoke}
          onReinstate={handleReinstate}
          onReset={handleReset}
        />
      </div>

      <section className="mt-10">
        <h2 className="font-display text-sm font-black uppercase tracking-plate">
          Enforcement surfaces
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium text-ink/80">
          Each one calls the same view function. None of them caches the answer,
          which is why a single revocation reaches all four with no further
          transactions.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {surfaces.map((surface, i) => (
            <SurfaceCard
              key={surface.id}
              surface={surface}
              index={i}
              generation={generation}
            />
          ))}
        </div>
      </section>

      {log.length > 0 && (
        <section className="mt-10 rounded-2xl border border-ink/20 bg-paper p-6">
          <h2 className="font-display text-sm font-black uppercase tracking-plate">
            Run log
          </h2>
          <ol className="mt-4 space-y-3">
            {log.map((entry, i) => (
              <li key={i} className="flex gap-4 border-b border-ink/10 pb-3 last:border-0">
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-ink/85">{entry.action}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{entry.detail}</p>
                </div>
                <span
                  className={[
                    'ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]',
                    entry.eligibleAfter ? 'text-admit' : 'text-refuse',
                  ].join(' ')}
                >
                  {entry.eligibleAfter ? 'Green' : 'Red'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-10">
        <EvidencePanel state={state} log={log} />
      </div>

      <footer className="mt-10 border-t border-ink/20 pt-5">
        <p className="font-mono text-[10px] font-semibold uppercase leading-relaxed tracking-[0.16em] text-ink/60">
          Identity, claim issuer, gate and resolver are simulated in this harness.
          The Walrus upload is live. Don&rsquo;t trust us. Verify us.
        </p>
      </footer>
    </main>
  );
}

'use client';

import type { ChainState, ClaimTopic } from '@/lib/mock/types';

interface Props {
  state: ChainState;
  onSubmitClaim: (topic: ClaimTopic) => void;
  onRevoke: (topic: ClaimTopic) => void;
  onReinstate: (topic: ClaimTopic) => void;
  onReset: () => void;
}

function Button({
  children,
  onClick,
  tone = 'default',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-md border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors',
        'disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/30',
        tone === 'danger'
          ? 'border-refuse text-refuse hover:bg-refuse hover:text-paper'
          : 'border-ink/40 text-ink hover:bg-ink hover:text-paper',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export default function Controls({
  state,
  onSubmitClaim,
  onRevoke,
  onReinstate,
  onReset,
}: Props) {
  const topics = Object.keys(state.claims) as ClaimTopic[];

  return (
    <section className="rounded-2xl border border-ink/20 bg-paper p-6">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink/20 pb-3">
        <h2 className="font-display text-sm font-black uppercase tracking-plate">
          Booth controls
        </h2>
        <button
          onClick={onReset}
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60 underline-offset-4 hover:text-ink hover:underline"
        >
          Reset run
        </button>
      </div>

      <p className="mt-3 text-xs font-medium leading-relaxed text-ink/80">
        The issuer signs off-chain and hands the claim over. The holder submits it
        themselves — the issuer never writes to the identity. Revoking writes only
        to the issuer&rsquo;s own contract, and every surface re-reads.
      </p>

      <div className="mt-4 space-y-2.5">
        {topics.map((topic) => {
          const claim = state.claims[topic];
          const held = Boolean(claim.addedAt);
          const revoked = state.revoked[topic];

          return (
            <div
              key={topic}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/15 px-3 py-2"
            >
              <span className="text-sm font-bold">{claim.label}</span>
              <div className="flex gap-2">
                <Button onClick={() => onSubmitClaim(topic)} disabled={held}>
                  {held ? 'Submitted' : 'Submit claim'}
                </Button>
                {revoked ? (
                  <Button onClick={() => onReinstate(topic)}>Reinstate</Button>
                ) : (
                  <Button
                    tone="danger"
                    onClick={() => onRevoke(topic)}
                    disabled={!held}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

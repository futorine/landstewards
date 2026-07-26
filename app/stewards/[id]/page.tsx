'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLand } from '@/components/LandStateProvider';
import {
  stewardById,
  slotForSteward,
  slotSubname,
  firstFreeSlot,
  pendingStewards,
  SLOT_STEWARD_KEY,
} from '@/lib/mock/land';
import SiteHeader from '@/components/SiteHeader';
import LandScene from '@/components/LandScene';
import PersonIcon from '@/components/PersonIcon';
import EnsTag from '@/components/EnsTag';
import EnsRecordWrite from '@/components/EnsRecordWrite';

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export default function StewardProfile() {
  const params = useParams<{ id: string }>();
  const { state, attest, transfer } = useLand();
  const [admin, setAdmin] = useState(false);
  const [transferTo, setTransferTo] = useState('');

  const steward = stewardById(state, params.id);

  if (!steward) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <SiteHeader />
        <div className="rounded-2xl border border-ink/20 bg-paper p-8 text-center">
          <p className="font-display text-lg font-bold">Steward not found.</p>
          <Link
            href="/"
            className="mt-3 inline-block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-foil underline underline-offset-4"
          >
            Back to the roster
          </Link>
        </div>
      </main>
    );
  }

  const attested = steward.status === 'attested';
  const slot = slotForSteward(state, steward.id);
  const free = firstFreeSlot(state);
  const others = pendingStewards(state).filter((s) => s.id !== steward.id);

  // Where an attest would seat them (used for the real slot-record write).
  const targetSlot = attested ? slot : free;
  const targetSubname = targetSlot
    ? slotSubname(state.project, targetSlot.index)
    : null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <SiteHeader />

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        {/* Identity card */}
        <section className="rounded-2xl border border-ink/20 bg-paper p-6">
          <div className="flex items-center gap-4">
            <span
              className={[
                'flex shrink-0 items-center justify-center rounded-full border p-3',
                attested
                  ? 'border-admit/60 bg-admit/15 text-admit'
                  : 'border-refuse/60 bg-refuse/15 text-refuse',
              ].join(' ')}
            >
              <PersonIcon size={30} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl font-black uppercase tracking-[0.04em]">
                {steward.displayName}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate font-mono text-xs font-bold text-ink/70">
                {steward.ensName}
                <EnsTag />
              </p>
            </div>
          </div>

          <span
            className={[
              'mt-4 inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]',
              attested ? 'bg-admit/15 text-admit' : 'bg-refuse/15 text-refuse',
            ].join(' ')}
          >
            {attested ? 'Attested steward' : 'In process'}
          </span>

          <dl className="mt-5 space-y-3">
            <Row label="Role" value={steward.role} />
            {steward.bio && <Row label="Bio" value={steward.bio} />}
            <Row label="Wallet" value={steward.walletAddress} mono />
            <Row
              label="Slot"
              value={
                attested && slot
                  ? slotSubname(state.project, slot.index)
                  : 'Not seated'
              }
              mono
              tag={attested && slot ? <EnsTag /> : undefined}
            />
          </dl>
        </section>

        {/* Land + admin actions */}
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-ink/20 bg-paper">
            <div className="aspect-[16/7] w-full">
              <LandScene className="h-full w-full" />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-ink/20 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-black uppercase tracking-[0.06em]">
                  {state.project.displayName}
                </p>
                <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
                  {state.project.ensName}
                </p>
              </div>
              <Link
                href="/"
                className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-foil underline underline-offset-4"
              >
                View roster
              </Link>
            </div>
          </div>

          {/* Admin panel */}
          <div className="rounded-2xl border border-ink/20 bg-paper p-6">
            <div className="flex items-center justify-between gap-4 border-b border-ink/20 pb-3">
              <h3 className="font-display text-sm font-black uppercase tracking-plate">
                Project controls
              </h3>
              <label className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/60">
                Admin
                <input
                  type="checkbox"
                  checked={admin}
                  onChange={(e) => setAdmin(e.target.checked)}
                  className="h-3.5 w-3.5 accent-foil"
                />
              </label>
            </div>

            {!admin ? (
              <p className="mt-3 text-xs font-medium leading-relaxed text-ink/70">
                Toggle admin to attest this steward and write their slot subname
                record on-chain, or to transfer their slot to another steward.
              </p>
            ) : !attested ? (
              /* Attest a pending steward */
              !targetSubname ? (
                <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-refuse">
                  All {state.project.maxSlots} slots are full — release one first.
                </p>
              ) : PRIVY_CONFIGURED ? (
                <div className="mt-3">
                  <EnsRecordWrite
                    node={targetSubname}
                    recordKey={SLOT_STEWARD_KEY}
                    value={steward.ensName}
                    title={`Attest → seat in ${targetSubname}`}
                    description={
                      <>
                        Writes the slot subname&rsquo;s{' '}
                        <code className="font-bold text-foil">
                          {SLOT_STEWARD_KEY}
                        </code>{' '}
                        record to <strong>{steward.ensName}</strong>. Real
                        Sepolia transaction, signed by your Privy embedded wallet.
                        Confirms the attestation once the write lands.
                      </>
                    }
                    confirmLabel="Attest & write slot"
                    onConfirmed={() => attest(steward.id)}
                  />
                </div>
              ) : (
                <MockAttest onAttest={() => attest(steward.id)} subname={targetSubname} />
              )
            ) : (
              /* Transfer an attested steward's slot */
              <div className="mt-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Transfer {slot ? slotSubname(state.project, slot.index) : 'slot'}
                </p>
                {others.length === 0 ? (
                  <p className="mt-2 text-xs font-medium text-ink/70">
                    No pending stewards to transfer to. Register one first.
                  </p>
                ) : (
                  <>
                    <select
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      className="input mt-2 w-full"
                    >
                      <option value="">Choose incoming steward…</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.displayName} · {o.ensName}
                        </option>
                      ))}
                    </select>

                    {transferTo && slot && PRIVY_CONFIGURED && (
                      <div className="mt-4">
                        <EnsRecordWrite
                          node={slotSubname(state.project, slot.index)}
                          recordKey={SLOT_STEWARD_KEY}
                          value={
                            stewardById(state, transferTo)?.ensName ?? ''
                          }
                          title="Transfer slot on-chain"
                          description="Overwrites the slot record to point at the incoming steward, then confirms the transfer locally."
                          confirmLabel="Sign & transfer"
                          onConfirmed={() =>
                            transfer(slot.index, transferTo)
                          }
                        />
                      </div>
                    )}
                    {transferTo && slot && !PRIVY_CONFIGURED && (
                      <button
                        onClick={() => transfer(slot.index, transferTo)}
                        className="mt-3 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper"
                      >
                        Transfer (mock)
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MockAttest({
  onAttest,
  subname,
}: {
  onAttest: () => void;
  subname: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium leading-relaxed text-ink/75">
        Privy isn&rsquo;t configured, so this attests in the local roster only
        (would write {subname}&rsquo;s record on-chain with Privy set up).
      </p>
      <button
        onClick={onAttest}
        className="mt-3 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper"
      >
        Attest (mock)
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  tag,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tag?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        {label}
        {tag}
      </dt>
      <dd
        className={[
          'mt-0.5 break-words text-sm font-semibold text-ink',
          mono ? 'font-mono text-xs' : '',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

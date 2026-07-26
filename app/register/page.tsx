'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLand } from '@/components/LandStateProvider';
import SiteHeader from '@/components/SiteHeader';
import WalletConnectField from '@/components/WalletConnectField';
import EnsTag from '@/components/EnsTag';

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
const PLACEHOLDER_WALLET = '0x0000000000000000000000000000000000000000';

type EnsCheck = 'idle' | 'checking' | 'resolves' | 'unresolved';

export default function RegisterPage() {
  const { register } = useLand();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [ensName, setEnsName] = useState('');
  const [role, setRole] = useState('');
  const [bio, setBio] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [ensCheck, setEnsCheck] = useState<EnsCheck>('idle');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = displayName.trim() !== '' && ensName.trim() !== '';

  /**
   * Real ENS read against Sepolia — proves the entered username resolves.
   * Non-blocking: registration proceeds either way (the name may not be
   * registered yet), but a green check is a nice on-chain signal.
   */
  async function checkEns() {
    const name = ensName.trim();
    if (!name) return;
    setEnsCheck('checking');
    try {
      const res = await fetch(
        `/api/ens/read?name=${encodeURIComponent(name)}&key=avatar`
      );
      // 200 (even with a null value) means the name has a resolver on-chain.
      setEnsCheck(res.ok ? 'resolves' : 'unresolved');
    } catch {
      setEnsCheck('unresolved');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const steward = register({
      displayName: displayName.trim(),
      ensName: ensName.trim(),
      role: role.trim() || 'Steward',
      bio: bio.trim(),
      walletAddress: walletAddress ?? PLACEHOLDER_WALLET,
    });
    router.push(`/stewards/${steward.id}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <SiteHeader />

      <div className="mx-auto max-w-xl">
        <h2 className="font-display text-3xl font-black uppercase tracking-[0.04em]">
          Register as a steward
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink/85">
          Put your name forward for a stewardship slot. You&rsquo;ll enter the
          roster as <span className="font-bold text-refuse">in process</span>{' '}
          until the project attests you — at which point a slot subname is
          assigned to your ENS name on-chain.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-ink/20 bg-paper p-6"
        >
          <Field label="Display name" required>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Mara Silveira"
              className="input"
              required
            />
          </Field>

          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
              Your ENS username <span className="text-refuse">*</span>
              <EnsTag />
            </label>
            <div className="mt-1 flex gap-2">
              <input
                value={ensName}
                onChange={(e) => {
                  setEnsName(e.target.value);
                  setEnsCheck('idle');
                }}
                placeholder="mara.eth"
                className="input flex-1"
                required
              />
              <button
                type="button"
                onClick={checkEns}
                disabled={ensName.trim() === '' || ensCheck === 'checking'}
                className="shrink-0 rounded-md border border-ink/40 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ensCheck === 'checking' ? 'Checking…' : 'Verify'}
              </button>
            </div>
            {ensCheck === 'resolves' && (
              <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-admit">
                ✓ Resolves on Sepolia
              </p>
            )}
            {ensCheck === 'unresolved' && (
              <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-refuse">
                Not found on-chain — you can still register
              </p>
            )}
          </div>

          <Field label="Role">
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Reef warden"
              className="input"
            />
          </Field>

          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What you'll steward and why."
              rows={3}
              className="input resize-none"
            />
          </Field>

          {PRIVY_CONFIGURED && (
            <WalletConnectField onAddress={setWalletAddress} />
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full rounded-md border-2 border-foil px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Registering…' : 'Register'}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        {label} {required && <span className="text-refuse">*</span>}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

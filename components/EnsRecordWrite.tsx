'use client';

import { useState } from 'react';
import {
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
} from '@privy-io/react-auth';
import type { EIP1193Provider } from 'viem';
import { sepolia } from 'viem/chains';
import {
  writeEnsTextWithProvider,
  type EnsWriteResult,
} from '@/lib/ens-write-client';
import EnsTag from './EnsTag';

/**
 * The project's one real on-chain action, reused wherever a text record is
 * written to ENS: a slot's `steward` pointer, or the project's `evidence`
 * pointer. Signs `setText(node, key, value)` live with the Privy embedded
 * wallet, then reads the record straight back off the resolver (server-side,
 * a different RPC path) to prove the round trip.
 *
 * Rendered only where NEXT_PUBLIC_PRIVY_APP_ID is configured, so the Privy
 * hooks always run inside a mounted PrivyProvider.
 */
export default function EnsRecordWrite({
  node,
  recordKey,
  value,
  title,
  description,
  confirmLabel = 'Sign & write on-chain',
  disabled = false,
  disabledReason,
  onConfirmed,
}: {
  node: string;
  recordKey: string;
  value: string;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  onConfirmed?: (result: EnsWriteResult, readBack: string | null) => void;
}) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const [status, setStatus] = useState<'idle' | 'writing'>('idle');
  const [result, setResult] = useState<EnsWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveRecord, setLiveRecord] = useState<string | null>(null);

  // Sign with the embedded wallet if there is one, otherwise the first
  // connected wallet (e.g. an injected Brave / MetaMask wallet). When the
  // connected wallet also owns the name, no setApprovalForAll is needed.
  const active = getEmbeddedConnectedWallet(wallets) ?? wallets[0];

  async function write() {
    setStatus('writing');
    setError(null);
    setResult(null);
    setLiveRecord(null);

    try {
      const wallet = getEmbeddedConnectedWallet(wallets) ?? wallets[0];
      if (!wallet) {
        throw new Error('No connected wallet. Connect one and try again.');
      }

      // Make sure the wallet is on Sepolia before signing.
      await wallet.switchChain(sepolia.id);
      const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;

      const writeResult = await writeEnsTextWithProvider(
        provider,
        node,
        recordKey,
        value
      );
      setResult(writeResult);

      // Read the record straight back from the resolver to prove the round trip.
      const readRes = await fetch(
        `/api/ens/read?name=${encodeURIComponent(node)}&key=${encodeURIComponent(recordKey)}`
      );
      const readData = await readRes.json();
      const readBack = readRes.ok ? readData.value : null;
      if (readRes.ok) setLiveRecord(readBack);

      onConfirmed?.(writeResult, readBack);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="border-t border-ink/25 pt-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        {title}
        <EnsTag />
      </p>
      {description && (
        <p className="mt-1 text-xs font-medium leading-relaxed text-ink/75">
          {description}
        </p>
      )}
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-ink/10 p-3 font-mono text-[11px] font-semibold text-ink">
        {`setText(namehash("${node}"), "${recordKey}", "${value}")`}
      </pre>

      {!authenticated ? (
        <button
          onClick={login}
          disabled={!ready}
          className="mt-3 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ready ? 'Connect to sign' : 'Loading…'}
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button
            onClick={write}
            disabled={status === 'writing' || disabled}
            title={disabled ? disabledReason : undefined}
            className="rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'writing' ? 'Signing…' : confirmLabel}
          </button>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
            {active
              ? `${active.address.slice(0, 6)}…${active.address.slice(-4)}`
              : 'no wallet connected'}
            {' · '}
            <button
              onClick={logout}
              className="underline underline-offset-4 hover:text-ink"
            >
              Sign out
            </button>
          </span>
        </div>
      )}

      {disabled && disabledReason && (
        <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-refuse">
          {disabledReason}
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-refuse bg-refuse/15 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-refuse">
            Write failed
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{error}</p>
          <p className="mt-2 text-xs font-medium text-ink/75">
            Most likely cause: the connected wallet isn&rsquo;t authorized to
            write records for {node}, or the resolver doesn&rsquo;t implement
            setText. See the README on authorizing the signing address.
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
              Transaction · {result.status}
            </p>
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-xs font-semibold text-ink underline underline-offset-4 hover:text-foil"
            >
              {result.txHash}
            </a>
          </div>

          {liveRecord && (
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                Read back live from the resolver
                <EnsTag />
              </p>
              <p className="mt-1 break-all font-mono text-xs font-bold text-admit">
                {liveRecord}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

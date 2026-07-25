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
 * Step 2 of the evidence flow: write the Walrus pointer to the ENS `evidence`
 * text record, signed live by the presenter's Privy embedded wallet. Rendered
 * only when NEXT_PUBLIC_PRIVY_APP_ID is configured (see EvidencePanel), so the
 * Privy hooks below always run inside a mounted PrivyProvider.
 */
export default function EnsPublish({
  ensName,
  textKey,
  value,
}: {
  ensName: string;
  textKey: string;
  value: string;
}) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const [status, setStatus] = useState<'idle' | 'publishing'>('idle');
  const [result, setResult] = useState<EnsWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveRecord, setLiveRecord] = useState<string | null>(null);

  const embedded = getEmbeddedConnectedWallet(wallets);

  async function publish() {
    setStatus('publishing');
    setError(null);
    setResult(null);
    setLiveRecord(null);

    try {
      const wallet = getEmbeddedConnectedWallet(wallets);
      if (!wallet) {
        throw new Error(
          'No embedded wallet found. Log out and back in to provision one.'
        );
      }

      // Embedded wallets follow defaultChain, but switch explicitly in case
      // the session was left on another network.
      await wallet.switchChain(sepolia.id);
      const provider = (await wallet.getEthereumProvider()) as EIP1193Provider;

      const writeResult = await writeEnsTextWithProvider(
        provider,
        ensName,
        textKey,
        value
      );
      setResult(writeResult);

      // Read the record straight back from the resolver — server-side, via a
      // different RPC path than the one that wrote it — to prove the round trip.
      const readRes = await fetch(
        `/api/ens/read?name=${encodeURIComponent(ensName)}&key=${encodeURIComponent(textKey)}`
      );
      const readData = await readRes.json();
      if (readRes.ok) setLiveRecord(readData.value);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <div className="border-t border-ink/25 pt-4">
      <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        Step 2 — write the pointer on-chain
        <EnsTag />
      </p>
      <p className="mt-1 text-xs font-medium leading-relaxed text-ink/75">
        Sets the <code className="font-bold text-foil">{textKey}</code> text
        record on {ensName}&rsquo;s resolver to the Read URL above. Real Sepolia
        transaction, signed by your Privy embedded wallet.
      </p>

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
            onClick={publish}
            disabled={status === 'publishing'}
            className="rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'publishing' ? 'Publishing…' : 'Publish to ENS'}
          </button>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
            {embedded
              ? `${embedded.address.slice(0, 6)}…${embedded.address.slice(-4)}`
              : 'no embedded wallet'}
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

      {error && (
        <div className="mt-4 rounded-lg border border-refuse bg-refuse/15 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-refuse">
            Write failed
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{error}</p>
          <p className="mt-2 text-xs font-medium text-ink/75">
            Most likely cause: this embedded wallet isn&rsquo;t authorized to
            write records for {ensName}, or the resolver doesn&rsquo;t implement
            setText. See the README on authorizing the operator address.
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

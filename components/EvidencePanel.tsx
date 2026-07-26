'use client';

import { useState } from 'react';
import { buildEvidenceBundle, serializeBundle } from '@/lib/evidence';
import { useLand } from './LandStateProvider';
import EnsRecordWrite from './EnsRecordWrite';

interface UploadResult {
  blobId: string;
  readUrl: string;
  sizeBytes: number;
  deduplicated: boolean;
}

/** Optional: publish a snapshot of the registry to Walrus, then point the
 *  project's ENS `evidence` record at it. Both steps are live. */
const ENS_EVIDENCE_KEY = 'evidence';
const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export default function EvidencePanel() {
  const { state } = useLand();
  const [status, setStatus] = useState<'idle' | 'uploading'>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    setStatus('uploading');
    setError(null);
    setResult(null);

    try {
      const bundle = serializeBundle(buildEvidenceBundle(state));
      const res = await fetch('/api/walrus', { method: 'POST', body: bundle });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'The upload did not complete.');
      else setResult(data as UploadResult);
    } catch (err) {
      setError(`Could not reach the upload route: ${(err as Error).message}`);
    } finally {
      setStatus('idle');
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-ink bg-paper text-ink">
      <div className="perforated h-2 w-full" aria-hidden />

      <div className="p-6">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink/25 pb-3">
          <h2 className="font-display text-sm font-black uppercase tracking-plate">
            Registry evidence
          </h2>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-foil">
            Live · Walrus
          </span>
        </div>

        <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-ink/85">
          Publish a content-addressed snapshot of the roster and slot
          assignments to Walrus, then point {state.project.ensName}&rsquo;s{' '}
          <code className="font-bold text-foil">{ENS_EVIDENCE_KEY}</code> record
          at it — so anyone can audit the project at source.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            onClick={upload}
            disabled={status === 'uploading'}
            className="rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'uploading' ? 'Uploading…' : 'Publish snapshot'}
          </button>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
            {state.stewards.length} stewards · {state.slots.filter((s) => s.stewardId).length} slots filled
          </span>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-refuse bg-refuse/15 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-refuse">
              Upload failed
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{error}</p>
            <p className="mt-2 text-xs font-medium text-ink/75">
              The public testnet publisher is rate-limited and occasionally busy.
              Wait a moment and publish again, or point WALRUS_PUBLISHER at
              another endpoint.
            </p>
          </div>
        )}

        {result && (
          <div className="mt-5 space-y-4 rounded-lg border border-ink/25 p-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                Blob ID
              </p>
              <p className="mt-1 break-all font-mono text-sm font-bold text-foil">
                {result.blobId}
              </p>
            </div>

            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                Anyone can open this
              </p>
              <a
                href={result.readUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all font-mono text-xs font-semibold text-ink underline underline-offset-4 hover:text-foil"
              >
                {result.readUrl}
              </a>
            </div>

            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
              {(result.sizeBytes / 1024).toFixed(1)} KiB
              {result.deduplicated && ' · already stored, deduplicated by content'}
            </p>

            {PRIVY_CONFIGURED ? (
              <EnsRecordWrite
                node={state.project.ensName}
                recordKey={ENS_EVIDENCE_KEY}
                value={result.readUrl}
                title="Point the project's ENS record at it"
                description="Real Sepolia transaction, signed by your Privy embedded wallet, then read back off the resolver."
                confirmLabel="Publish to ENS"
              />
            ) : (
              <div className="border-t border-ink/25 pt-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                  Point the ENS record at it
                </p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-ink/75">
                  Set <code className="font-bold text-foil">NEXT_PUBLIC_PRIVY_APP_ID</code>{' '}
                  to sign the {ENS_EVIDENCE_KEY} record write from a Privy
                  embedded wallet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

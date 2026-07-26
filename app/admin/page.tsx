'use client';

import { useState, useEffect } from 'react';
import {
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
} from '@privy-io/react-auth';
import type { EIP1193Provider } from 'viem';
import { sepolia } from 'viem/chains';
import SiteHeader from '@/components/SiteHeader';
import EnsTag from '@/components/EnsTag';
import {
  readProjectMintContext,
  createSlotSubname,
  type SlotMintResult,
} from '@/lib/ens-v2-write-client';
import {
  prepareRegistration,
  finalizeRegistration,
  friendlyError,
  type PreparedRegistration,
} from '@/lib/ens-v2-register-client';

/** Survives a refresh so a paid-for commit is never stranded. */
const PREPARED_KEY = 'landstewards.preparedRegistration';

/**
 * Project provisioning against ENSv2 on Sepolia.
 *
 * Slot subnames ARE minted here for real — `register()` on the project's own
 * subregistry, gas-only, no ERC-20 and no commit/reveal. Registering the 2LD
 * itself is still done in the ENS app, because it is priced in a test ERC-20
 * that has to be acquired out-of-band; automating the approve+commit+reveal
 * dance would add a funding dependency without removing a manual step.
 */

const ENS_APP = 'https://sepolia.app.ens.domains';

interface SlotCheck {
  index: number;
  label: string;
  subname: string;
  exists: boolean;
  owner: string | null;
  resolver: string | null;
  steward: string | null;
}

interface VerifyResult {
  name: string;
  subregistry: string | null;
  parent: { resolves: boolean; subregistry: string | null };
  slots: SlotCheck[];
  slotsReady: number;
  slotsRequested: number;
  recordKey: string;
  hint?: string;
}

export default function AdminPage() {
  const privyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  const [name, setName] = useState(
    process.env.NEXT_PUBLIC_ENS_NAME ?? 'landstewards.eth'
  );
  const [slotCount, setSlotCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [minting, setMinting] = useState(false);
  const [mintLog, setMintLog] = useState<string[]>([]);
  const [mintTxs, setMintTxs] = useState<SlotMintResult[]>([]);

  async function verify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/ens/project?name=${encodeURIComponent(name.trim())}&slots=${slotCount}`
      );
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Verification failed.');
      else setResult(data as VerifyResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const allReady =
    result && result.parent.resolves && result.slotsReady === result.slotsRequested;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <SiteHeader />

      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-black uppercase tracking-[0.04em]">
          Create a project
        </h2>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink/85">
          A project is an ENS name whose subnames are its stewardship slots.
          Register the name in the ENS app, then mint its slots here — that part
          is a real on-chain write against the project&rsquo;s ENSv2
          subregistry.
        </p>

        {/* Inputs */}
        <div className="mt-6 rounded-2xl border border-ink/20 bg-paper p-6">
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                Project name <EnsTag />
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setResult(null);
                }}
                placeholder="landstewards.eth"
                className="input mt-1"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
                Stewardship slots
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={slotCount}
                onChange={(e) => {
                  setSlotCount(
                    Math.max(1, Math.min(20, Number(e.target.value) || 1))
                  );
                  setResult(null);
                }}
                className="input mt-1 w-28"
              />
            </div>
          </div>
        </div>

        {/* Step 1 — availability + registration, both real */}
        <div className="mt-6 rounded-2xl border border-ink/20 bg-paper p-6">
          <h3 className="font-display text-sm font-black uppercase tracking-plate">
            1 · Register the project name <EnsTag />
          </h3>
          <p className="mt-3 text-xs font-medium leading-relaxed text-ink/75">
            Checks availability against the ENSv2 registrar, then registers the
            name and wires in a resolver and a subregistry so it can hold slots
            immediately. Priced in Sepolia test USDC, which is minted for you.
          </p>

          {privyEnabled ? (
            <ProjectRegistrar name={name.trim()} onDone={verify} />
          ) : (
            <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-refuse">
              Set NEXT_PUBLIC_PRIVY_APP_ID to enable registration
            </p>
          )}

          <p className="mt-4 font-mono text-[10px] font-medium leading-relaxed text-ink/55">
            Already own the name, or prefer a UI?{' '}
            <a
              href={ENS_APP}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-foil underline underline-offset-4"
            >
              sepolia.app.ens.domains ↗
            </a>{' '}
            works too — skip to step 2.
          </p>
        </div>

        {/* Step 2 — automated */}
        <div className="mt-6 rounded-2xl border border-ink/20 bg-paper p-6">
          <h3 className="font-display text-sm font-black uppercase tracking-plate">
            2 · Mint the stewardship slots <EnsTag />
          </h3>
          <p className="mt-3 text-xs font-medium leading-relaxed text-ink/75">
            Creates <code className="font-bold text-foil">slot-1</code> …{' '}
            <code className="font-bold text-foil">slot-{slotCount}</code> by
            calling <code className="font-bold text-foil">register()</code> on
            the project&rsquo;s ENSv2 subregistry. Gas only. Each new slot
            inherits the project&rsquo;s resolver, so the attest flow has
            somewhere to write immediately. Already-existing slots are skipped,
            so it is safe to re-run.
          </p>

          {privyEnabled ? (
            <SlotMinter
              projectName={name.trim()}
              slotCount={slotCount}
              minting={minting}
              setMinting={setMinting}
              mintLog={mintLog}
              setMintLog={setMintLog}
              mintTxs={mintTxs}
              setMintTxs={setMintTxs}
              onDone={verify}
            />
          ) : (
            <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-refuse">
              Set NEXT_PUBLIC_PRIVY_APP_ID to enable on-chain minting
            </p>
          )}
        </div>

        {/* Step 3 — verify */}
        <div className="mt-6 rounded-2xl border border-ink/20 bg-paper p-6">
          <h3 className="font-display text-sm font-black uppercase tracking-plate">
            3 · Verify on-chain
          </h3>
          <p className="mt-3 text-xs font-medium leading-relaxed text-ink/75">
            Reads each slot&rsquo;s registration state from the subregistry.
            Nothing is trusted until it reads back from the chain.
          </p>
          <button
            onClick={verify}
            disabled={busy || !name.trim()}
            className="mt-4 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify on-chain'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-refuse bg-refuse/15 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-refuse">
              Verification failed
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-ink/20 bg-paper p-6">
            <h3 className="font-display text-sm font-black uppercase tracking-plate">
              On-chain state
            </h3>

            <p
              className={[
                'mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
                result.parent.resolves ? 'text-admit' : 'text-refuse',
              ].join(' ')}
            >
              {result.parent.resolves ? '✓' : '✗'} {result.name}
              {result.parent.resolves
                ? ' has a subregistry'
                : ' — no ENSv2 subregistry'}
            </p>

            {result.subregistry && (
              <p className="mt-1 break-all font-mono text-[10px] font-medium text-ink/50">
                {result.subregistry}
              </p>
            )}

            {result.hint && (
              <p className="mt-2 text-xs font-medium leading-relaxed text-refuse">
                {result.hint}
              </p>
            )}

            <ul className="mt-3 space-y-1.5">
              {result.slots.map((s) => (
                <li
                  key={s.subname}
                  className={[
                    'font-mono text-[11px] font-semibold',
                    s.exists ? 'text-admit' : 'text-refuse',
                  ].join(' ')}
                >
                  {s.exists ? '✓' : '✗'} {s.subname}
                  {s.exists ? (
                    <span className="text-ink/60">
                      {' · '}
                      {s.steward
                        ? `${result.recordKey} = ${s.steward}`
                        : 'no steward record yet'}
                    </span>
                  ) : (
                    <span className="text-ink/60"> · not registered</span>
                  )}
                </li>
              ))}
            </ul>

            <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
              {result.slotsReady}/{result.slotsRequested} slots ready
            </p>

            {allReady ? (
              <div className="mt-4 border-t border-ink/25 pt-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-admit">
                  Project is ready
                </p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-ink/75">
                  Set this in{' '}
                  <code className="font-bold text-foil">.env.local</code> and
                  restart the dev server:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-ink/10 p-3 font-mono text-[11px] font-semibold text-ink">
                  {`NEXT_PUBLIC_ENS_NAME=${result.name}`}
                </pre>
                <p className="mt-2 text-xs font-medium leading-relaxed text-ink/75">
                  And set{' '}
                  <code className="font-bold text-foil">
                    maxSlots: {result.slotsReady}
                  </code>{' '}
                  in{' '}
                  <code className="font-bold text-foil">lib/mock/land.ts</code>.
                </p>
              </div>
            ) : (
              <div className="mt-4 border-t border-ink/25 pt-4">
                <p className="text-xs font-medium leading-relaxed text-ink/75">
                  Mint the missing slots in step 2, or run with{' '}
                  <code className="font-bold text-foil">maxSlots</code> ={' '}
                  {result.slotsReady} to match what exists today.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Availability check + two-stage registration.
 *
 * The reveal is a separate button rather than a timer-fired call: wallets
 * reject signing prompts the user didn't initiate, and by that point the
 * commit has already been paid for. The prepared state is persisted to
 * localStorage so a refresh mid-wait doesn't strand it.
 */
function ProjectRegistrar({
  name,
  onDone,
}: {
  name: string;
  onDone: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const active = getEmbeddedConnectedWallet(wallets) ?? wallets[0];

  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<{
    available: boolean;
    priceFormatted: string;
    name: string;
  } | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);

  const [working, setWorking] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<PreparedRegistration | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<{ explorerUrl: string } | null>(null);

  // Restore a commit that outlived a page refresh.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREPARED_KEY);
      if (raw) setPrepared(JSON.parse(raw) as PreparedRegistration);
    } catch {
      /* corrupt entry — ignore and start over */
    }
  }, []);

  // Drives the countdown only; it never triggers the reveal itself.
  useEffect(() => {
    if (!prepared || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [prepared, done]);

  const push = (msg: string) => setLog((prev) => [...prev, msg]);

  async function check() {
    setChecking(true);
    setAvail(null);
    setAvailError(null);
    try {
      const res = await fetch(`/api/ens/available?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) setAvailError(data.error ?? 'Check failed.');
      else setAvail(data);
    } catch (err) {
      setAvailError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function provider() {
    await active!.switchChain(sepolia.id);
    return (await active!.getEthereumProvider()) as EIP1193Provider;
  }

  async function start() {
    if (!active) return;
    setWorking(true);
    setLog([]);
    setDone(null);
    try {
      const p = await prepareRegistration(await provider(), name, push);
      setPrepared(p);
      localStorage.setItem(PREPARED_KEY, JSON.stringify(p));
    } catch (err) {
      push(`Failed: ${friendlyError(err)}`);
    } finally {
      setWorking(false);
    }
  }

  async function finish() {
    if (!active || !prepared) return;
    setWorking(true);
    try {
      push('Revealing…');
      const res = await finalizeRegistration(await provider(), prepared);
      push(
        res.status === 'success'
          ? `Registered ${prepared.name}.`
          : 'Reveal transaction reverted.'
      );
      if (res.status === 'success') {
        setDone(res);
        localStorage.removeItem(PREPARED_KEY);
        onDone();
      }
    } catch (err) {
      push(`Failed: ${friendlyError(err)}`);
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    localStorage.removeItem(PREPARED_KEY);
    setPrepared(null);
    setLog([]);
    setDone(null);
  }

  if (!ready) return null;

  const secondsLeft = prepared
    ? Math.max(0, Math.ceil((prepared.readyAt - now) / 1000))
    : 0;
  const canReveal = Boolean(prepared) && secondsLeft === 0 && !done;
  const btn =
    'rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={check} disabled={checking || !name} className={btn}>
          {checking ? 'Checking…' : 'Check availability'}
        </button>

        {!authenticated ? (
          <button onClick={login} className={btn}>
            Connect wallet
          </button>
        ) : (
          !prepared && (
            <button
              onClick={start}
              disabled={working || !name || !active || avail?.available === false}
              className={btn}
            >
              {working ? 'Working…' : 'Register project'}
            </button>
          )
        )}

        {prepared && !done && (
          <button onClick={finish} disabled={!canReveal || working} className={btn}>
            {working
              ? 'Working…'
              : canReveal
                ? 'Confirm registration'
                : `Wait ${secondsLeft}s`}
          </button>
        )}

        {prepared && (
          <button onClick={reset} className={btn}>
            Reset
          </button>
        )}
      </div>

      {availError && (
        <p className="mt-3 font-mono text-[11px] font-bold text-refuse">
          {availError}
        </p>
      )}

      {avail && (
        <p
          className={[
            'mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]',
            avail.available ? 'text-admit' : 'text-refuse',
          ].join(' ')}
        >
          {avail.available
            ? `✓ ${avail.name} is available · ${avail.priceFormatted} USDC / year`
            : `✗ ${avail.name} is already registered`}
        </p>
      )}

      {prepared && !done && (
        <p className="mt-2 font-mono text-[10px] font-medium leading-relaxed text-ink/55">
          Committed for {prepared.name}. Resolver{' '}
          {prepared.resolver.slice(0, 10)}… · subregistry{' '}
          {prepared.subregistry.slice(0, 10)}…
        </p>
      )}

      {log.length > 0 && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-ink/10 p-3 font-mono text-[10px] font-medium leading-relaxed text-ink/80">
          {log.join('\n')}
        </pre>
      )}

      {done && (
        <a
          href={done.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-mono text-[10px] font-bold text-foil underline underline-offset-4"
        >
          View registration ↗
        </a>
      )}
    </div>
  );
}

/** Wallet-connected slot minting. Split out so Privy hooks only run when enabled. */
function SlotMinter({
  projectName,
  slotCount,
  minting,
  setMinting,
  mintLog,
  setMintLog,
  mintTxs,
  setMintTxs,
  onDone,
}: {
  projectName: string;
  slotCount: number;
  minting: boolean;
  setMinting: (v: boolean) => void;
  mintLog: string[];
  setMintLog: (v: string[]) => void;
  mintTxs: SlotMintResult[];
  setMintTxs: (v: SlotMintResult[]) => void;
  onDone: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const active = getEmbeddedConnectedWallet(wallets) ?? wallets[0];

  async function mint() {
    if (!active) return;
    setMinting(true);
    setMintLog([]);
    setMintTxs([]);
    const log: string[] = [];
    const txs: SlotMintResult[] = [];
    const push = (line: string) => {
      log.push(line);
      setMintLog([...log]);
    };

    try {
      await active.switchChain(sepolia.id);
      const provider = (await active.getEthereumProvider()) as EIP1193Provider;

      push(`Reading ${projectName} subregistry…`);
      const ctx = await readProjectMintContext(provider, projectName);
      push(`Subregistry ${ctx.subregistry.slice(0, 10)}… · resolver ${ctx.resolver.slice(0, 10)}…`);

      for (let i = 0; i < slotCount; i += 1) {
        const label = `slot-${i + 1}`;
        try {
          const res = await createSlotSubname(provider, projectName, i, ctx, push);
          if (!res) {
            push(`${label} — already exists, skipped`);
          } else {
            txs.push(res);
            setMintTxs([...txs]);
            push(`${label} — ${res.status === 'success' ? 'created' : 'REVERTED'}`);
          }
        } catch (err) {
          // Report and keep going: one bad slot shouldn't abort the rest.
          push(`${label} — failed: ${(err as Error).message}`);
        }
      }
      push('Done.');
      onDone();
    } catch (err) {
      push(`Failed: ${friendlyError(err)}`);
    } finally {
      setMinting(false);
    }
  }

  if (!ready) return null;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="mt-4 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper"
      >
        Connect wallet to mint
      </button>
    );
  }

  return (
    <div className="mt-4">
      {active && (
        <p className="font-mono text-[10px] font-medium text-ink/55">
          Signing as {active.address.slice(0, 6)}…{active.address.slice(-4)} — must
          own {projectName}
        </p>
      )}
      <button
        onClick={mint}
        disabled={minting || !projectName || !active}
        className="mt-2 rounded-md border-2 border-foil px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-foil transition-colors hover:bg-foil hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {minting ? 'Minting…' : `Mint ${slotCount} slots`}
      </button>

      {mintLog.length > 0 && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-ink/10 p-3 font-mono text-[10px] font-medium leading-relaxed text-ink/80">
          {mintLog.join('\n')}
        </pre>
      )}

      {mintTxs.length > 0 && (
        <ul className="mt-2 space-y-1">
          {mintTxs.map((t) => (
            <li key={t.txHash} className="font-mono text-[10px]">
              <a
                href={t.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-foil underline underline-offset-4"
              >
                {t.label} ↗ {t.txHash.slice(0, 12)}…
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

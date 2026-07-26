'use client';

import { useEffect } from 'react';
import {
  usePrivy,
  useWallets,
  getEmbeddedConnectedWallet,
} from '@privy-io/react-auth';

/**
 * Optional wallet connect for registration. Reports the active wallet's
 * address up to the form via onAddress. Uses the Privy embedded wallet if one
 * exists, otherwise the first connected wallet (e.g. an injected Brave /
 * MetaMask wallet). Only mounted when Privy is configured (see the register
 * page), so these hooks always sit inside a PrivyProvider.
 */
export default function WalletConnectField({
  onAddress,
}: {
  onAddress: (address: string | null) => void;
}) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const active = getEmbeddedConnectedWallet(wallets) ?? wallets[0];

  useEffect(() => {
    onAddress(active?.address ?? null);
  }, [active?.address, onAddress]);

  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
        Wallet (optional)
      </p>
      {authenticated && active ? (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-bold text-ink">
            {active.address.slice(0, 6)}…{active.address.slice(-4)}
          </span>
          <button
            type="button"
            onClick={logout}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60 underline underline-offset-4 hover:text-ink"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={login}
          disabled={!ready}
          className="mt-1 rounded-md border border-ink/40 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ready ? 'Connect wallet' : 'Loading…'}
        </button>
      )}
    </div>
  );
}

'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { sepolia } from 'viem/chains';

/**
 * Privy provides the embedded wallet that signs every ENS record write —
 * slot assignments and the evidence pointer. The presenter logs in with
 * email/social, Privy provisions a self-custodial wallet, and that wallet
 * signs setText live on Sepolia — no browser extension, and no signing key
 * anywhere in this repo.
 *
 * If NEXT_PUBLIC_PRIVY_APP_ID isn't set, we render children WITHOUT the
 * provider so the rest of the app still builds and runs. The on-chain writes
 * are the only thing gated on it — see EnsRecordWrite, which is rendered only
 * when this id is present.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        // Embedded wallet, created on first login for users without one.
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        // Sepolia only — matches the team's scope.
        defaultChain: sepolia,
        supportedChains: [sepolia],
        appearance: { theme: 'dark', accentColor: '#b08d3f' },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

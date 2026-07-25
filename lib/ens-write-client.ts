/**
 * CLIENT-SIDE ENS WRITE — signed by the presenter's Privy embedded wallet.
 *
 * The whole point of doing this in the browser: no signing key touches the
 * server bundle or .env. The embedded wallet's EIP-1193 provider both signs
 * and broadcasts the setText transaction, and viem's public actions over that
 * same provider wait for the receipt — so no NEXT_PUBLIC RPC is needed either.
 *
 * The signing address must still be authorized to write records for the name
 * (owner/controller, or approved via the registry / resolver). That's a
 * one-time pre-demo step — see the README.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  namehash,
  type EIP1193Provider,
} from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';
import { TEXT_RESOLVER_ABI } from './ens';

export interface EnsWriteResult {
  txHash: `0x${string}`;
  status: 'success' | 'reverted';
  explorerUrl: string;
}

export async function writeEnsTextWithProvider(
  provider: EIP1193Provider,
  name: string,
  key: string,
  value: string
): Promise<EnsWriteResult> {
  const normalized = normalize(name);

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(provider),
  });

  // The embedded wallet is the only connected account.
  const [account] = await walletClient.getAddresses();
  if (!account) {
    throw new Error('No wallet account available to sign the transaction.');
  }

  // Resolve which contract currently serves the name, through the same
  // provider. viem knows the Sepolia Universal Resolver address.
  const resolverAddress = await publicClient.getEnsResolver({ name: normalized });
  if (!resolverAddress) {
    throw new Error(
      `${name} has no resolver set on Sepolia. Set one in the ENS Manager app first.`
    );
  }

  const txHash = await walletClient.writeContract({
    account,
    address: resolverAddress,
    abi: TEXT_RESOLVER_ABI,
    functionName: 'setText',
    args: [namehash(normalized), key, value],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    status: receipt.status,
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
  };
}

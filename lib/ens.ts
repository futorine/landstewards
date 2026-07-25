/**
 * LIVE COMPONENT — real ENS reads against Sepolia. This is the second live
 * piece of the project alongside Walrus; everything else (Identity,
 * ClaimIssuer, EligibilityGate) stays simulated.
 *
 * Reads use viem's built-in ENS actions, which resolve through the ENS
 * Universal Resolver Contract and work out of the box against viem's
 * `sepolia` chain definition. If ENS ever redeploys and viem's bundled
 * address goes stale, ENS_UNIVERSAL_RESOLVER overrides it — check
 * https://docs.ens.domains/learn/deployments if reads start failing.
 *
 * The evidence WRITE does not live here. It is signed client-side by the
 * presenter's Privy embedded wallet — see lib/ens-write-client.ts. That
 * keeps any signing key out of this server bundle entirely; the only shared
 * piece is the setText ABI below.
 */

import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';

const RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

// Only needed if viem's bundled Sepolia ENS addresses are ever stale.
const UNIVERSAL_RESOLVER_OVERRIDE = process.env.ENS_UNIVERSAL_RESOLVER as
  | `0x${string}`
  | undefined;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const resolverOpt = UNIVERSAL_RESOLVER_OVERRIDE
  ? { universalResolverAddress: UNIVERSAL_RESOLVER_OVERRIDE }
  : {};

/** resolver.text(node, key) via the Universal Resolver — a real chain read. */
export async function readEnsText(
  name: string,
  key: string
): Promise<string | null> {
  return publicClient.getEnsText({ name: normalize(name), key, ...resolverOpt });
}

/** Which resolver contract currently serves this name. */
export async function readEnsResolverAddress(name: string) {
  return publicClient.getEnsResolver({ name: normalize(name), ...resolverOpt });
}

/**
 * ENSIP-5 / EIP-634 standard text-record write interface, implemented by
 * ENS's Public Resolver and by most custom resolvers that support text
 * records. Shared with the client-side write helper.
 *
 * NOTE: if the deployed resolver is a fully custom contract built only for
 * the computed status/policy/identity keys, it may not accept arbitrary
 * writes — confirm it implements setText for the `evidence` key before the
 * demo, or the write will revert.
 */
export const TEXT_RESOLVER_ABI = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

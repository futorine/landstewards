/**
 * LIVE COMPONENT — real ENS reads against Sepolia. Only the steward roster is
 * simulated (see lib/mock/land.ts); reads here hit the chain.
 *
 * Reads use viem's built-in ENS actions, which resolve through the ENS
 * Universal Resolver and work out of the box against viem's `sepolia` chain
 * definition. If ENS redeploys and viem's bundled address goes stale,
 * ENS_UNIVERSAL_RESOLVER overrides it.
 *
 * Writes do not live here. They are signed client-side by the connected
 * wallet — see lib/ens-write-client.ts — which keeps any signing key out of
 * this server bundle entirely. The only shared piece is the setText ABI below.
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

/**
 * Deliberately no `readEnsResolverAddress` helper here.
 *
 * Resolving a name to its resolver looks like an existence check but is not
 * one: ENSv2 wildcard resolution returns the parent's resolver for any
 * unregistered subname, so every conceivable name appears to resolve. Slot
 * existence comes from registry state — see `readSlotState` in lib/ens-v2.ts.
 */

/**
 * ENSIP-5 / EIP-634 standard text-record write interface, implemented by
 * ENS's Public Resolver and by most custom resolvers that support text
 * records. Shared with the client-side write helper.
 *
 * NOTE: a fully custom resolver may not accept arbitrary keys. Confirm it
 * implements setText for the keys this app writes (`steward`, `evidence`)
 * before relying on it, or the write will revert.
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

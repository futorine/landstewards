/**
 * ENSv2 on Sepolia — addresses, ABIs, and the registry walk.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Sepolia has migrated to ENSv2. The legacy stack (BaseRegistrar +
 * ETHRegistrarController + NameWrapper) is deauthorised — `controllers()`
 * returns false for every legacy controller — so the v1 provisioning path
 * cannot work. But v2 is fully deployed and *is* usable; this module is the
 * verified interface to it.
 *
 * Every address and ABI below was checked against live Sepolia, not copied
 * from docs. docs.ens.domains still lists the dead v1 controller
 * (0xfb3cE5D0…) as current, so treat published addresses with suspicion.
 * Addresses cross-checked against ensdomains/ens-cli, then confirmed to have
 * bytecode and to answer the calls used here.
 *
 * ARCHITECTURE (differs sharply from v1)
 * --------------------------------------
 * v2 is hierarchical: each name owns a *subregistry* contract governing its
 * direct subnames, rather than every name living in one flat registry.
 *
 *   ETH registry ──getSubregistry("landstewards")──▶ subregistry ──▶ slot-N
 *
 * So creating `slot-N.landstewards.eth` means calling `register()` on
 * landstewards.eth's OWN subregistry — not on any global contract. The parent
 * must have a subregistry deployed; without one, subnames cannot exist at all.
 *
 * TWO GOTCHAS THAT COST REAL DEBUGGING TIME
 * -----------------------------------------
 * 1. REGISTRATION IS PRICED IN ERC-20, NOT ETH. `ETHRegistrar.register` is
 *    nonpayable and takes a `paymentToken`. On Sepolia that's a test USDC at
 *    6 decimals (~7.99 USDC/year). Passing the zero address reverts. You must
 *    `approve()` the registrar before revealing. Sending ETH does nothing.
 *
 * 2. YOU CANNOT TEST SUBNAME EXISTENCE WITH A RESOLVER LOOKUP. ENSv2 does
 *    wildcard resolution: the Universal Resolver happily returns the PARENT's
 *    resolver for any unregistered subname. `slot-99.landstewards.eth` and
 *    `totally-made-up.landstewards.eth` both resolve to a real, non-zero
 *    address. Checking for a non-zero resolver reports every conceivable name
 *    as existing. Existence must come from `getState().status` on the parent
 *    subregistry — that is what `readSlotState` below does.
 */

import {
  createPublicClient,
  http,
  parseAbi,
  zeroAddress,
  getAddress,
  keccak256,
  encodeAbiParameters,
  concat,
  getContractAddress,
} from 'viem';
import type { Address, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { labelhash } from 'viem/ens';

const RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

/** Verified live on Sepolia — all have bytecode and answer these calls. */
export const SEPOLIA_ENS_V2 = {
  /** Root .eth registry; walk down from here via getSubregistry(label). */
  registry: '0xDEDB92913A25abE1f7BCDD85D8A344a43B398B67',
  /** ETHRegistrar — commit/reveal for 2LDs. ERC-20 priced. */
  registrar: '0x8c2E866B439358c41AE05De9cbE8A00BFEFafFcA',
  /**
   * Test USDC, 6 decimals. Registration currency; must be approved.
   * `mint(address,uint256)` on it is PERMISSIONLESS on Sepolia — anyone can
   * mint themselves test funds, which is what makes automated registration
   * practical here.
   */
  paymentToken: '0x3DfC8b53dAFa5eBbb071a8B97678Ab534Ed838D9',
  /** VerifiableFactory — CREATE2-deploys both resolver and subregistry proxies. */
  factory: '0xD2a632D8a8b67c2c4398c255CbD7aF8dd7236198',
  resolverImplementation: '0xdcE5205A553573FFd47629327DDdf36186022FfA',
  resolverProxyLogic: '0x917C561a74Df398646e06f3FFAA51DB8e8330C5A',
  subregistryImplementation: '0x0F99e7Ea74903AfCB7224d0354fD7428A6f92917',
} as const satisfies Record<string, Address>;

/** Commit/reveal window on the v2 registrar, read from the deployed contract. */
export const V2_MIN_COMMITMENT_AGE_SECONDS = 60;
export const V2_MAX_COMMITMENT_AGE_SECONDS = 86400;

/** One year, the default registration duration. */
export const ONE_YEAR_SECONDS = 31536000n;

/**
 * ENSv2's EnhancedAccessControl packs each role into a 4-bit nybble, so a 1 in
 * every nybble grants all roles. Used when initializing a resolver or
 * subregistry proxy the caller owns outright.
 */
export const ALL_ROLES = BigInt(
  '0x1111111111111111111111111111111111111111111111111111111111111111'
);

export const VERIFIABLE_FACTORY_ABI = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address)',
]);

/** Both the OwnedResolver and UserRegistry proxies share this initializer. */
export const PROXY_INIT_ABI = parseAbi([
  'function initialize(address account, uint256 roleBitmap)',
]);

/** getState().status — 2 means the name is actually registered. */
export const V2_STATUS_REGISTERED = 2;

export const V2_REGISTRY_ABI = parseAbi([
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource))',
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expires) returns (uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function setResolver(uint256 anyId, address resolver)',
]);

export const V2_REGISTRAR_ABI = parseAbi([
  // NOTE the SCREAMING_CASE. The v1 controller used camelCase
  // `minCommitmentAge()`; v2 flipped it. Getting this wrong produces a
  // "function reverted" error that looks like a permissions problem.
  'function MIN_COMMITMENT_AGE() view returns (uint256)',
  'function MAX_COMMITMENT_AGE() view returns (uint256)',
  'function isAvailable(string label) view returns (bool)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)',
]);

export const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  // Permissionless on the Sepolia test token — verified by simulating it from
  // two unrelated accounts, both of which succeeded. Not present on real USDC.
  'function mint(address to, uint256 amount)',
]);

/**
 * ENSv2 packs each role into the low bit of a 4-bit nybble, with the
 * "admin" variant of a role shifted 128 bits up. This grants a slot owner the
 * practical set: renew, set resolver, set subregistry, unregister — plus the
 * admin bits so they can delegate. Mirrors ens-cli's default.
 */
const ROLE_UNREGISTER = 1n << 12n;
const ROLE_RENEW = 1n << 16n;
const ROLE_SET_SUBREGISTRY = 1n << 20n;
const ROLE_SET_RESOLVER = 1n << 24n;

export const V2_DEFAULT_OWNER_ROLES =
  ROLE_UNREGISTER |
  ROLE_RENEW |
  ROLE_SET_SUBREGISTRY |
  ROLE_SET_RESOLVER |
  (ROLE_UNREGISTER << 128n) |
  (ROLE_RENEW << 128n) |
  (ROLE_SET_SUBREGISTRY << 128n) |
  (ROLE_SET_RESOLVER << 128n);

const serverClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

/**
 * Predict a VerifiableFactory proxy address without calling the chain.
 *
 * This MUST be computed rather than simulated. `deployProxy` reverts on a
 * CREATE2 collision, so simulating it to learn the address fails precisely
 * when the proxy already exists — i.e. exactly when you need to detect that
 * and skip. Computing first makes a re-run after a partial failure resumable.
 *
 * The factory deploys the same EIP-1167-style proxy for every implementation
 * (the proxy delegates to `resolverProxyLogic`; the implementation is applied
 * through the initializer), so one formula covers both resolver and
 * subregistry. Verified against a live deployment.
 */
export function computeProxyAddress(deployer: Address, salt: bigint): Address {
  const outerSalt = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }],
      [deployer, salt]
    )
  );
  const bytecode = concat([
    '0x3d604d80600a3d3981f3363d3d373d3d3d363d73',
    SEPOLIA_ENS_V2.resolverProxyLogic,
    '0x5af43d82803e903d91602b57fd5bf3',
    outerSalt,
  ]);
  return getContractAddress({
    bytecode,
    from: SEPOLIA_ENS_V2.factory,
    opcode: 'CREATE2',
    salt: outerSalt,
  });
}

/** labelhash as the uint256 id `getState` expects. */
export function labelId(label: string): bigint {
  return BigInt(labelhash(label));
}

/**
 * Walk the v2 hierarchy to the subregistry that governs `name`'s direct
 * subnames. Returns null when the name has no subregistry — which is a real
 * and common state, and means subnames CANNOT be created until one is
 * deployed (see `subregistry deploy` in ens-cli).
 */
export async function findSubregistry(
  name: string,
  client: PublicClient = serverClient as PublicClient
): Promise<Address | null> {
  const labels = name.split('.');
  if (labels.length < 2 || labels[labels.length - 1] !== 'eth') {
    throw new Error(`ENSv2 lookups here only support .eth names. Got: ${name}`);
  }

  let registry: Address = SEPOLIA_ENS_V2.registry;
  // Walk right-to-left, skipping the "eth" TLD itself.
  for (let i = labels.length - 2; i >= 0; i -= 1) {
    const next: Address = await client.readContract({
      address: registry,
      abi: V2_REGISTRY_ABI,
      functionName: 'getSubregistry',
      args: [labels[i]!],
    });
    if (!next || next === zeroAddress) return null;
    registry = getAddress(next);
  }
  return registry;
}

export interface NameAvailability {
  label: string;
  name: string;
  available: boolean;
  /** Raw base + premium, in payment-token units (USDC, 6dp). */
  priceBase: bigint;
  pricePremium: bigint;
  priceTotal: bigint;
  /** Human-readable total, e.g. "7.99". */
  priceFormatted: string;
}

/** Is a 2LD label free, and what does a year cost in the ERC-20 payment token? */
export async function readNameAvailability(
  name: string,
  client: PublicClient = serverClient as PublicClient
): Promise<NameAvailability> {
  const labels = name.split('.');
  if (labels.length !== 2 || labels[1] !== 'eth') {
    throw new Error(
      `Project names must be a second-level .eth name (e.g. myproject.eth). Got: ${name}`
    );
  }
  const label = labels[0]!;

  const available = await client.readContract({
    address: SEPOLIA_ENS_V2.registrar,
    abi: V2_REGISTRAR_ABI,
    functionName: 'isAvailable',
    args: [label],
  });

  // Pricing an unavailable label can revert, so only quote when it's free.
  let priceBase = 0n;
  let pricePremium = 0n;
  if (available) {
    [priceBase, pricePremium] = await client.readContract({
      address: SEPOLIA_ENS_V2.registrar,
      abi: V2_REGISTRAR_ABI,
      functionName: 'getRegisterPrice',
      args: [label, ONE_YEAR_SECONDS, SEPOLIA_ENS_V2.paymentToken],
    });
  }

  const priceTotal = priceBase + pricePremium;
  return {
    label,
    name,
    available,
    priceBase,
    pricePremium,
    priceTotal,
    // Payment token is 6-decimal USDC.
    priceFormatted: (Number(priceTotal) / 1e6).toFixed(2),
  };
}

export interface SlotState {
  label: string;
  exists: boolean;
  owner: Address | null;
  resolver: Address | null;
  expiry: bigint | null;
}

/**
 * Authoritative existence check for a subname, via the parent's subregistry.
 *
 * Deliberately NOT a resolver lookup: wildcard resolution makes every
 * unregistered subname appear to resolve (see the header note).
 */
export async function readSlotState(
  subregistry: Address,
  label: string,
  client: PublicClient = serverClient as PublicClient
): Promise<SlotState> {
  const [state, resolver] = await Promise.all([
    client.readContract({
      address: subregistry,
      abi: V2_REGISTRY_ABI,
      functionName: 'getState',
      args: [labelId(label)],
    }),
    client
      .readContract({
        address: subregistry,
        abi: V2_REGISTRY_ABI,
        functionName: 'getResolver',
        args: [label],
      })
      .catch(() => zeroAddress as Address),
  ]);

  const exists = Number(state.status) === V2_STATUS_REGISTERED;
  return {
    label,
    exists,
    owner: exists ? getAddress(state.latestOwner) : null,
    resolver: exists && resolver !== zeroAddress ? getAddress(resolver) : null,
    expiry: exists ? state.expiry : null,
  };
}

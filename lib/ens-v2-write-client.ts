/**
 * CLIENT-SIDE ENSv2 SUBNAME CREATION — signed by the connected wallet.
 *
 * Mints `slot-N.<project>.eth` by calling `register()` on the project's own
 * subregistry. This is a real, working on-chain write: it costs only gas.
 * Unlike registering a 2LD, it needs no ERC-20 payment token and no
 * commit/reveal — those apply to the ETHRegistrar, not to subregistries.
 *
 * The signer must hold the registrar role on the project's subregistry, which
 * the project owner does by default. Every call is simulated first so an
 * unauthorised or malformed attempt surfaces a readable reason instead of an
 * opaque gas-estimation failure.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  zeroAddress,
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type EIP1193Provider,
} from 'viem';
import { sepolia } from 'viem/chains';
import {
  SEPOLIA_ENS_V2,
  V2_REGISTRY_ABI,
  V2_DEFAULT_OWNER_ROLES,
  findSubregistry,
  readSlotState,
  labelId,
} from './ens-v2';
import { awaitTabFocus, friendlyError } from './wallet-ux';

export interface SlotMintResult {
  label: string;
  subname: string;
  txHash: `0x${string}`;
  status: 'success' | 'reverted';
  explorerUrl: string;
}

/** Pull a human-readable reason out of viem's nested error chain. */
function revertReason(err: unknown): string {
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      return (
        reverted.data?.errorName ??
        reverted.reason ??
        reverted.shortMessage ??
        'reverted without a reason'
      );
    }
    return err.shortMessage || err.message;
  }
  return (err as Error)?.message ?? String(err);
}

/**
 * Details needed to mint slots under a project, read straight from the chain
 * so nothing is hardcoded per-project.
 */
export interface ProjectMintContext {
  subregistry: Address;
  /** Resolver the project itself uses; new slots inherit it. */
  resolver: Address;
  /** Project expiry; slots cannot outlive their parent. */
  expiry: bigint;
}

export async function readProjectMintContext(
  provider: EIP1193Provider,
  projectName: string
): Promise<ProjectMintContext> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(provider),
  });

  const subregistry = await findSubregistry(projectName, publicClient);
  if (!subregistry) {
    throw new Error(
      `${projectName} has no ENSv2 subregistry, so slots cannot be created under it. Deploy one for the project first.`
    );
  }

  // The project's own label lives directly under .eth, so its state and
  // resolver come from the root ETH registry.
  const label = projectName.split('.')[0]!;
  const [state, resolver] = await Promise.all([
    publicClient.readContract({
      address: SEPOLIA_ENS_V2.registry,
      abi: V2_REGISTRY_ABI,
      functionName: 'getState',
      args: [labelId(label)],
    }),
    publicClient.readContract({
      address: SEPOLIA_ENS_V2.registry,
      abi: V2_REGISTRY_ABI,
      functionName: 'getResolver',
      args: [label],
    }),
  ]);

  if (resolver === zeroAddress) {
    throw new Error(
      `${projectName} has no resolver set, so slots would have nowhere to store steward records.`
    );
  }

  return { subregistry, resolver, expiry: state.expiry };
}

/**
 * Mint one slot subname. Skips silently if it already exists, so the caller
 * can re-run over a partially provisioned project without special-casing.
 */
export async function createSlotSubname(
  provider: EIP1193Provider,
  projectName: string,
  index: number,
  ctx: ProjectMintContext,
  onLog?: (msg: string) => void
): Promise<SlotMintResult | null> {
  const label = `slot-${index + 1}`;
  const subname = `${label}.${projectName}`;

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: custom(provider),
  });

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('No wallet account available to sign.');

  // Already there — nothing to do. Makes the whole run idempotent.
  const existing = await readSlotState(ctx.subregistry, label, publicClient);
  if (existing.exists) return null;

  const args = [
    label,
    account,
    zeroAddress, // no child subregistry: slots have no subnames of their own
    ctx.resolver,
    V2_DEFAULT_OWNER_ROLES,
    ctx.expiry,
  ] as const;

  try {
    await publicClient.simulateContract({
      address: ctx.subregistry,
      abi: V2_REGISTRY_ABI,
      functionName: 'register',
      args,
      account,
    });
  } catch (err) {
    throw new Error(`Cannot create ${subname}: ${revertReason(err)}`);
  }

  // Minting N slots means N sequential prompts, and confirming one hands focus
  // to the wallet popup. Without this wait the next call fires while the tab is
  // still backgrounded and the wallet refuses it — which previously failed
  // every slot after the first.
  await awaitTabFocus(() =>
    onLog?.(`Waiting for this tab to regain focus before signing ${label}…`)
  );

  let txHash: `0x${string}`;
  try {
    txHash = await walletClient.writeContract({
      account,
      address: ctx.subregistry,
      abi: V2_REGISTRY_ABI,
      functionName: 'register',
      args,
    });
  } catch (err) {
    throw new Error(`Could not create ${subname}: ${friendlyError(err)}`);
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    label,
    subname,
    txHash,
    status: receipt.status,
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
  };
}

/**
 * CLIENT-SIDE ENSv2 PROJECT REGISTRATION — signed by the connected wallet.
 *
 * Registers a 2LD `.eth` project name and wires it up so it can immediately
 * hold stewardship slots. Five on-chain steps, split across two user actions
 * because ENSv2 enforces a commit/reveal delay:
 *
 *   prepare()  1. deploy an OwnedResolver proxy      (skipped if it exists)
 *              2. deploy a UserRegistry subregistry  (skipped if it exists)
 *              3. mint test USDC                     (skipped if funded)
 *              4. approve the registrar
 *              5. commit(hash)
 *   -- wait MIN_COMMITMENT_AGE (60s) --
 *   finalize() 6. register(...)  ← wires resolver + subregistry in at birth
 *
 * WHY finalize() IS A SEPARATE CALL, NOT A TIMER
 * ----------------------------------------------
 * An earlier version of this flow auto-fired the signing popup when a
 * countdown hit zero. Wallets reject prompts the user didn't initiate, which
 * surfaced as an opaque "Wallet timeout" — and by then the commit was already
 * paid for. finalize() must be triggered by a real click.
 *
 * WHY THE RESOLVER AND SUBREGISTRY ARE DEPLOYED FIRST
 * ---------------------------------------------------
 * `register()` accepts both as arguments, so deploying them up front means the
 * name is usable the moment it exists — no follow-up setResolver /
 * setSubregistry transactions, and no window where the project resolves but
 * cannot hold slots. Both are CREATE2 proxies from the VerifiableFactory, so
 * the addresses are deterministic and redeploys are detected and skipped.
 *
 * The commitment BINDS all of these: label, owner, secret, subregistry,
 * resolver, duration, referrer. Any mismatch between prepare() and finalize()
 * makes the reveal revert, which is why the secret and both addresses are
 * returned for the caller to persist.
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  zeroAddress,
  zeroHash,
  encodeFunctionData,
  toHex,
  keccak256,
  encodeAbiParameters,
  stringToBytes,
  BaseError,
  ContractFunctionRevertedError,
  type Address,
  type EIP1193Provider,
} from 'viem';
import { sepolia } from 'viem/chains';
import { namehash } from 'viem/ens';
import {
  SEPOLIA_ENS_V2,
  V2_REGISTRAR_ABI,
  VERIFIABLE_FACTORY_ABI,
  PROXY_INIT_ABI,
  ERC20_ABI,
  ALL_ROLES,
  ONE_YEAR_SECONDS,
  V2_MIN_COMMITMENT_AGE_SECONDS,
  computeProxyAddress,
} from './ens-v2';
import { awaitTabFocus, friendlyError } from './wallet-ux';

export { friendlyError };

export interface PreparedRegistration {
  name: string;
  label: string;
  owner: Address;
  secret: `0x${string}`;
  resolver: Address;
  subregistry: Address;
  duration: string;
  commitment: `0x${string}`;
  /** Epoch ms after which finalize() may be called. */
  readyAt: number;
  txHashes: { step: string; hash: `0x${string}` }[];
}

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

function randomSecret(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Deterministic CREATE2 salts, matching ens-cli so a project provisioned here
 * and one provisioned with the CLI land on the same addresses.
 */
function subregistrySalt(name: string): bigint {
  return BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
        [keccak256(stringToBytes('UserRegistry')), namehash(name), 0n]
      )
    )
  );
}

function resolverSalt(owner: Address): bigint {
  return BigInt(
    keccak256(
      encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
        [keccak256(stringToBytes('OwnedResolver')), owner, 0n]
      )
    )
  );
}

function clients(provider: EIP1193Provider) {
  return {
    wallet: createWalletClient({ chain: sepolia, transport: custom(provider) }),
    pub: createPublicClient({ chain: sepolia, transport: custom(provider) }),
  };
}

/**
 * Simulate, then send — and keep the two failure modes distinct.
 *
 * viem reports a wallet/RPC rejection from `writeContract` as though it were a
 * revert ("reverted with the following reason: Error processing the
 * transaction"), which sends you hunting for a contract bug that isn't there.
 * Simulating first settles the question: if the simulation passes and the send
 * still fails, the chain would have accepted it and the problem is the wallet.
 *
 * Every caller here is idempotent, so retrying after a wallet-side failure is
 * always safe.
 */
async function simulateThenSend<const TAbi extends readonly unknown[]>(
  provider: EIP1193Provider,
  account: Address,
  params: {
    address: Address;
    abi: TAbi;
    functionName: string;
    args: readonly unknown[];
  },
  what: string,
  onLog?: (msg: string) => void
): Promise<`0x${string}`> {
  const { wallet, pub } = clients(provider);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pub.simulateContract({ ...(params as any), account });
  } catch (err) {
    throw new Error(`${what} would fail on-chain: ${revertReason(err)}`);
  }

  // prepare() signs up to five transactions in a row; each confirmation hands
  // focus to the wallet popup, so the next prompt must wait for it to return.
  await awaitTabFocus(() =>
    onLog?.('Waiting for this tab to regain focus before the next signature…')
  );

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await wallet.writeContract({ ...(params as any), account });
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    if (
      msg.includes('User rejected') ||
      msg.includes('User denied') ||
      msg.includes('rejected the request')
    ) {
      throw new Error(`${what} was rejected in the wallet.`);
    }
    throw new Error(
      `${what} passed simulation but your wallet refused to send it — so the chain would have accepted it and this is a wallet or RPC problem, not a contract one. ` +
        `Try again (completed steps are skipped), or switch the wallet's Sepolia RPC endpoint. Wallet said: ${friendlyError(err)}`
    );
  }
}

/**
 * Deploy a VerifiableFactory proxy, or adopt the existing one.
 *
 * The address is COMPUTED, never simulated. `deployProxy` reverts on a CREATE2
 * collision, so simulating it to discover the address fails exactly when the
 * proxy already exists — which made an interrupted prepare() unresumable: the
 * retry died on the step that had already succeeded. Computing first turns a
 * completed step into a cheap no-op.
 */
async function deployProxyOnce(
  provider: EIP1193Provider,
  account: Address,
  implementation: Address,
  salt: bigint,
  onLog: (msg: string) => void,
  label: string
): Promise<{ address: Address; hash?: `0x${string}` }> {
  const { pub } = clients(provider);
  const address = computeProxyAddress(account, salt);

  const existing = await pub.getBytecode({ address });
  if (existing && existing !== '0x') {
    onLog(`${label} already at ${address.slice(0, 10)}… — reusing`);
    return { address };
  }

  const initData = encodeFunctionData({
    abi: PROXY_INIT_ABI,
    functionName: 'initialize',
    args: [account, ALL_ROLES],
  });

  onLog(`Deploying ${label}…`);
  const hash = await simulateThenSend(
    provider,
    account,
    {
      address: SEPOLIA_ENS_V2.factory,
      abi: VERIFIABLE_FACTORY_ABI,
      functionName: 'deployProxy',
      args: [implementation, salt, initData],
    },
    `Deploying the ${label}`,
    onLog
  );
  await pub.waitForTransactionReceipt({ hash });
  onLog(`${label} deployed at ${address.slice(0, 10)}…`);
  return { address, hash };
}

/**
 * Steps 1–5. Returns everything finalize() needs; the caller MUST persist it,
 * because losing the secret means the commit is unusable and must be redone.
 */
export async function prepareRegistration(
  provider: EIP1193Provider,
  name: string,
  onLog: (msg: string) => void
): Promise<PreparedRegistration> {
  const labels = name.split('.');
  if (labels.length !== 2 || labels[1] !== 'eth') {
    throw new Error(`Project names must be a 2LD .eth name. Got: ${name}`);
  }
  const label = labels[0]!;

  const { wallet, pub } = clients(provider);
  const [account] = await wallet.getAddresses();
  if (!account) throw new Error('No wallet account available to sign.');

  const available = await pub.readContract({
    address: SEPOLIA_ENS_V2.registrar,
    abi: V2_REGISTRAR_ABI,
    functionName: 'isAvailable',
    args: [label],
  });
  if (!available) throw new Error(`${name} is already registered.`);

  const txHashes: { step: string; hash: `0x${string}` }[] = [];

  // 1 + 2 — resolver and subregistry, deployed up front so register() can
  // wire them in and the project is immediately able to hold slots.
  const resolverRes = await deployProxyOnce(
    provider,
    account,
    SEPOLIA_ENS_V2.resolverImplementation,
    resolverSalt(account),
    onLog,
    'resolver'
  );
  if (resolverRes.hash) txHashes.push({ step: 'resolver', hash: resolverRes.hash });

  const subRes = await deployProxyOnce(
    provider,
    account,
    SEPOLIA_ENS_V2.subregistryImplementation,
    subregistrySalt(name),
    onLog,
    'subregistry'
  );
  if (subRes.hash) txHashes.push({ step: 'subregistry', hash: subRes.hash });

  // 3 — price the name, then mint test USDC if short.
  const [base, premium] = await pub.readContract({
    address: SEPOLIA_ENS_V2.registrar,
    abi: V2_REGISTRAR_ABI,
    functionName: 'getRegisterPrice',
    args: [label, ONE_YEAR_SECONDS, SEPOLIA_ENS_V2.paymentToken],
  });
  const price = base + premium;
  onLog(`Price: ${(Number(price) / 1e6).toFixed(2)} USDC for 1 year`);

  const balance = await pub.readContract({
    address: SEPOLIA_ENS_V2.paymentToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account],
  });

  if (balance < price) {
    // The Sepolia payment token has a permissionless mint, so funding is a
    // transaction rather than a trip to a faucet. Mint a small surplus over
    // the shortfall — enough to absorb a price move between here and the
    // reveal, without minting a number large enough to look alarming.
    const want = (price - balance) * 2n;
    onLog(`Minting ${(Number(want) / 1e6).toFixed(2)} test USDC…`);
    const hash = await simulateThenSend(
      provider,
      account,
      {
        address: SEPOLIA_ENS_V2.paymentToken,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [account, want],
      },
      'Minting test USDC',
      onLog
    );
    await pub.waitForTransactionReceipt({ hash });
    txHashes.push({ step: 'mint', hash });
  } else {
    onLog('Test USDC balance is sufficient — skipped mint');
  }

  // 4 — approve the registrar to pull the fee.
  const allowance = await pub.readContract({
    address: SEPOLIA_ENS_V2.paymentToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account, SEPOLIA_ENS_V2.registrar],
  });
  if (allowance < price) {
    onLog('Approving the registrar…');
    const hash = await simulateThenSend(
      provider,
      account,
      {
        address: SEPOLIA_ENS_V2.paymentToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [SEPOLIA_ENS_V2.registrar, price * 4n],
      },
      'Approving the registrar',
      onLog
    );
    await pub.waitForTransactionReceipt({ hash });
    txHashes.push({ step: 'approve', hash });
  } else {
    onLog('Registrar already approved — skipped');
  }

  // 5 — commit. The hash binds every argument reveal will replay.
  const secret = randomSecret();
  const commitment = await pub.readContract({
    address: SEPOLIA_ENS_V2.registrar,
    abi: V2_REGISTRAR_ABI,
    functionName: 'makeCommitment',
    args: [
      label,
      account,
      secret,
      subRes.address,
      resolverRes.address,
      ONE_YEAR_SECONDS,
      zeroHash,
    ],
  });

  onLog('Committing…');
  const commitHash = await simulateThenSend(
    provider,
    account,
    {
      address: SEPOLIA_ENS_V2.registrar,
      abi: V2_REGISTRAR_ABI,
      functionName: 'commit',
      args: [commitment],
    },
    'Committing',
    onLog
  );
  await pub.waitForTransactionReceipt({ hash: commitHash });
  txHashes.push({ step: 'commit', hash: commitHash });
  onLog(`Committed. Wait ${V2_MIN_COMMITMENT_AGE_SECONDS}s, then confirm.`);

  return {
    name,
    label,
    owner: account,
    secret,
    resolver: resolverRes.address,
    subregistry: subRes.address,
    duration: ONE_YEAR_SECONDS.toString(),
    commitment,
    readyAt: Date.now() + V2_MIN_COMMITMENT_AGE_SECONDS * 1000,
    txHashes,
  };
}

export interface RegistrationResult {
  txHash: `0x${string}`;
  status: 'success' | 'reverted';
  explorerUrl: string;
}

/** Step 6 — the reveal. Must replay prepare()'s arguments exactly. */
export async function finalizeRegistration(
  provider: EIP1193Provider,
  prepared: PreparedRegistration
): Promise<RegistrationResult> {
  const { wallet, pub } = clients(provider);
  const [account] = await wallet.getAddresses();
  if (!account) throw new Error('No wallet account available to sign.');

  if (account.toLowerCase() !== prepared.owner.toLowerCase()) {
    throw new Error(
      `The commitment was made by ${prepared.owner}, but the connected wallet is ${account}. Reveal must come from the committing account.`
    );
  }

  const args = [
    prepared.label,
    prepared.owner,
    prepared.secret,
    prepared.subregistry,
    prepared.resolver,
    BigInt(prepared.duration),
    SEPOLIA_ENS_V2.paymentToken,
    zeroHash,
  ] as const;

  // Simulated inside simulateThenSend, which matters here: a too-early reveal
  // or an expired commitment reverts, and gas estimation alone would surface
  // that as an unreadable failure.
  const txHash = await simulateThenSend(
    provider,
    account,
    {
      address: SEPOLIA_ENS_V2.registrar,
      abi: V2_REGISTRAR_ABI,
      functionName: 'register',
      args,
    },
    'Registering the name'
  );
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    status: receipt.status,
    explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
  };
}

export { zeroAddress };

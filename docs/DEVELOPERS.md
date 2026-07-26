# Landstewards — developer guide

Architecture, data model, and how the ENS integration is structured. For the
elevator pitch and quick start, see the [README](../README.md).

> **Contract addresses** They live in
> [`lib/ens-v2.ts`](../lib/ens-v2.ts), which is the single source of truth.


---

## 1. The core idea

Everything follows from one mapping:

| Concept | On-chain representation |
| --- | --- |
| Land project | An ENS name — `<project>.eth` |
| Stewardship slot | A subname — `slot-N.<project>.eth` |
| Who holds the slot | That subname's `steward` **text record** → the steward's own ENS name |
| Attesting a steward | Writing that text record |
| Transferring a slot | Overwriting that text record |

The slot is a *seat*, not an identity. Seats persist; people move between them.
That's why a slot is a subname (durable, ownable, enumerable) while occupancy is
a record (cheap to rewrite).

**Why text records rather than the subname's owner?** ENSv2 replaced the
registry but deliberately left resolvers unchanged — existing resolvers keep
working. Building on `setText`/`getEnsText` means the core flows survive
registry-level migrations untouched. Name *creation* APIs churn; record reads
and writes don't.

---

## 2. Layout

```
app/
  page.tsx                    overview — circle graphic, roster, evidence
  register/page.tsx           steward self-registration
  stewards/[id]/page.tsx      profile + admin attest / transfer
  admin/page.tsx              create a project: register, mint slots, verify
  api/ens/read/route.ts       server-side ENS text read
  api/ens/available/route.ts  name availability + price
  api/ens/project/route.ts    on-chain verification of a project's slots
  api/walrus/route.ts         server-side Walrus blob upload
components/
  LandStateProvider.tsx       in-memory roster (React Context) — the mock boundary
  StewardCircle.tsx           the signature graphic
  EnsRecordWrite.tsx          generic "sign a setText + read it back" component
  Providers.tsx               Privy provider (no-ops when unconfigured)
lib/
  mock/land.ts                the simulated domain model
  ens.ts                      server-side reads + shared setText ABI
  ens-write-client.ts         client-side record writes
  ens-v2.ts                   ENSv2 addresses, ABIs, registry traversal
  ens-v2-write-client.ts      slot subname minting
  ens-v2-register-client.ts   project registration (commit/reveal)
  wallet-ux.ts                shared browser-wallet ergonomics
  evidence.ts                 the Walrus snapshot bundle
```

---

## 3. Data model (`lib/mock/land.ts`)

```ts
LandProject { ensName, displayName, location, hectares, mandate, maxSlots }
Steward     { id, displayName, ensName, role, bio, walletAddress,
              status: 'pending' | 'attested', avatarSeed, registeredAt }
Slot        { index, stewardId: string | null }
LandState   { project, stewards, slots, log }
```

Reads mirror view calls (`attestedStewards`, `slotsFilled`, `slotForSteward`,
`firstFreeSlot`); writes are **pure functions returning new state**
(`registerSteward`, `attestSteward`, `transferSlot`, `releaseSlot`), which is
what makes them swappable for real contract calls later.

The one ENS-facing helper:

```ts
slotSubname(project, index) // → `slot-${index + 1}.${project.ensName}`
SLOT_STEWARD_KEY = 'steward'
```

> **`maxSlots` must match the number of slot subnames that actually exist
> on-chain.** If it's higher, attesting into a slot that was never minted
> reverts. `/admin` verifies the real count and reports the value to use.

### State lifetime

`LandStateProvider` holds the roster in memory. **It resets on reload** — fine
for a demo, and the Reset button does it deliberately. Note the asymmetry: reset
clears local state but **cannot undo on-chain writes**. A record written during
a demo stays written until overwritten.

---

## 4. ENS integration

### 4.1 Reads — `lib/ens.ts` (server)

`readEnsText` / `readEnsResolverAddress` use viem's built-in ENS actions, which
route through the Universal Resolver. These run server-side so `SEPOLIA_RPC_URL`
never reaches the browser. If viem's bundled Universal Resolver address ever
goes stale, `ENS_UNIVERSAL_RESOLVER` overrides it.

### 4.2 Record writes — `lib/ens-write-client.ts` (client)

`writeEnsTextWithProvider(provider, name, key, value)`:

1. Resolve the name's current resolver — never hardcoded.
2. `setText(namehash(name), key, value)` via the connected wallet.
3. Wait for the receipt, return the hash + explorer URL.

Both the wallet client and the public client are built over the **same EIP-1193
provider**, so no `NEXT_PUBLIC` RPC is needed and no signing key exists anywhere
in the repo.

`EnsRecordWrite.tsx` wraps this into the pattern used for both slot assignment
and the evidence pointer: connect → sign → **read the record back via a
different path** (the server route) to prove the round trip independently.

**Wallet selection** prefers the Privy embedded wallet and falls back to an
injected wallet. If the injected wallet already owns the name, no approval step
is needed at all.

### 4.3 Provisioning — `lib/ens-v2.ts` and its two clients

Sepolia runs **ENSv2**. The legacy registrar stack is decommissioned: its
controllers are deauthorised, so a v1 `register()` clears its own checks and
then reverts on a bare `require`, producing **empty revert data**. Wallets
surface that as "missing gas limit" or a reasonless "execution reverted" — the
symptom points nowhere near the cause. Names registered today do not appear in
the old registry at all.

#### Architecture

v2 is hierarchical. Each name owns a **subregistry** contract governing its
direct subnames, instead of every name living in one flat registry:

```
ETH registry ──getSubregistry("<project>")──▶ subregistry ──▶ slot-N
```

Creating `slot-N.<project>.eth` means calling `register()` on the **project's
own subregistry**, not on any global contract. A name with no subregistry cannot
have subnames at all. `findSubregistry()` walks this hierarchy.

Resolvers and subregistries are CREATE2 proxies deployed through a factory, so
their addresses are deterministic — which is what makes provisioning resumable.

#### Registering a project

Six on-chain steps across two user actions:

```
prepare()  1. deploy a resolver proxy       (skipped if it exists)
           2. deploy a subregistry proxy    (skipped if it exists)
           3. mint the test payment token   (skipped if funded)
           4. approve the registrar
           5. commit(hash)
  ── wait MIN_COMMITMENT_AGE ──
finalize() 6. register(...)                 ← resolver + subregistry wired in
```

`register()` takes the resolver and subregistry as arguments, so deploying them
first means the name can hold slots the instant it exists — no follow-up
transactions, and no window where the project resolves but can't be provisioned.

The commitment binds *every* argument the reveal replays, so the secret and both
proxy addresses are persisted to localStorage. Losing them strands a commit
that has already been paid for.

Minting slots is far simpler: no payment token, no commit/reveal, gas only.

---

### Design constraints worth knowing

These are properties of the platform, not preferences. Each one caused a real
failure before it was handled.

**Registration is priced in an ERC-20, not ETH.** The registrar's `register` is
nonpayable and takes a payment token; sending ETH does nothing and passing the
zero address reverts. The token must be approved first. On this testnet the
token happens to be permissionlessly mintable, which is what makes fully
automated registration practical — **do not assume that on mainnet.**

**Subname existence cannot be tested with a resolver lookup.** ENSv2 does
wildcard resolution: the Universal Resolver returns the *parent's* resolver for
any unregistered subname, so every conceivable name appears to resolve. A
verifier built on "does this have a non-zero resolver?" approves everything,
which is worse than having no verifier. Existence must come from registry state
(`getState(...).status`) on the parent subregistry.

**Published ABIs and addresses go stale.** Official docs have been observed
listing decommissioned contracts as current, and getter names have changed case
between versions in ways that revert rather than fail to compile. Verify against
the deployed contract — a call that *compiles* proves nothing about whether the
contract is live.

**Idempotency is load-bearing.** Multi-step flows get interrupted: a wallet
rejects, a tab loses focus, a page reloads. Every step here detects its own
completed work and skips it, so retrying is always safe. Deriving proxy
addresses by computation rather than by simulating the deploy matters for this —
a deploy simulation fails precisely when the thing already exists.

**Browser wallets won't prompt from a backgrounded tab.** Confirming one
transaction hands focus to the wallet popup, so a loop firing several
transactions in sequence has its later prompts refused. `wallet-ux.ts` gates
each signature on the tab being both visible and focused. It also distinguishes
a genuine contract revert from a wallet-side refusal, which viem otherwise
reports identically.

---

## 5. Privy

`components/Providers.tsx` mounts `PrivyProvider` scoped to Sepolia with
embedded-wallet-on-login. **If `NEXT_PUBLIC_PRIVY_APP_ID` is unset it renders
children without the provider** — so the app still builds and runs, and every
component using Privy hooks is gated behind the same check, never mounting a
hook outside a provider.

Operational notes:

- **Allowed origins** (Privy dashboard → Domains) must list your exact origin
  *including protocol and port*. A mismatch produces "this site is requesting a
  different domain".
- Embedded wallets need a **secure context** (https, or plain `localhost`).
- Whichever wallet signs **pays gas** and must hold Sepolia ETH.

---

## 6. Walrus evidence

`lib/evidence.ts` builds a snapshot of the project, slots, roster and totals;
`/api/walrus` uploads it server-side (avoiding CORS) to the public testnet
publisher. Walrus dedups by content, so re-uploading identical bytes returns
`alreadyCertified` rather than a new blob.

The bundle carries its own `provenance` block stating what is simulated and what
is live — the artifact declares its limits rather than relying on someone
reading this file.

Blobs are **public**: anyone with the blob ID can read them. Keeping project
details private would need encryption before upload — threshold encryption with
an on-chain access policy is the natural fit, since it keeps the storage layer
public while gating decryption.

---

## 7. Going live

1. **Privy dashboard** — add your origin (with port) to allowed origins; enable
   Ethereum embedded wallets.
2. **Fund the signer** — whichever wallet signs needs Sepolia ETH.
3. **Provision the project** — use `/admin`: check availability, register, mint
   the slots, verify. Or register the name elsewhere and use `/admin` only to
   mint slots into a name you already own.
4. **Configure** — set `NEXT_PUBLIC_ENS_NAME`, restart the dev server
   (`NEXT_PUBLIC_*` is baked in at build time), and set `maxSlots` in
   `lib/mock/land.ts` to the number of slots actually minted. `/admin` prints
   both values once verification passes.

Sign with the wallet that owns the name and no approval step is needed. If the
signer differs from the owner, grant it the relevant role on the project's
subregistry.

### Verifying end to end

- Register a steward → attest → confirm the explorer link resolves and the live
  read-back shows the steward's name.
- Cross-check independently in an ENS manager app: the slot subname → Records →
  `steward`.
- Transfer the slot to another steward → confirm the record changes.

---

## 8. Known constraints

- **`maxSlots` is manual.** It must match minted subnames; nothing enforces this
  yet. Reading the slot count from chain is the obvious fix — `/api/ens/project`
  already computes it.
- **Single project.** `NEXT_PUBLIC_ENS_NAME` names one project at build time.
  Multi-project needs the project to become route/runtime state
  (`/projects/[ens]`) rather than an env var — the data model already treats
  `project.ensName` as a field, so this is an extension, not a rewrite.
- **Roster is in-memory.** Survives navigation, not reload.
- **Steward ENS names are unvalidated strings.** The "Verify" button on
  `/register` is a best-effort resolver read, not a gate.
- **Nonce desync** in injected wallets after rapid signing shows as
  `nonce too low`. Clear the wallet's local transaction data; the earlier
  transaction usually already succeeded.

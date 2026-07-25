# ZK Credential Attestor — evidence archive

A harness that walks the refusal demo end to end, then publishes the run as a
content-addressed blob on **Walrus** (Sui's decentralized storage) and hands you
the ENS text record to point at it.

## The mock boundary

This matters more than anything else in this repo, and it's stated in the UI, the
footer, and inside the uploaded bundle itself — so nobody can mistake the harness
for the deployment.

| Component | Status |
| --- | --- |
| Identity, ClaimIssuer, EligibilityGate | **Simulated** (`lib/mock/chain.ts`) |
| Four enforcement surfaces | **Simulated** |
| ENS reads (`text`, `resolver`) | **Live** (`lib/ens.ts`, via viem against Sepolia) |
| ENS evidence write (`setText`) | **Live** — signed by a Privy embedded wallet (`lib/ens-write-client.ts`) |
| Walrus blob upload | **Live** (`app/api/walrus/route.ts`) |

The mock's function names and call graph mirror the real contracts
(`isClaimValid` → `isEligible` → `text`), so swapping the remaining simulated
pieces for viem calls is a substitution, not a rewrite.

## Run it

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_PRIVY_APP_ID to enable the ENS write
npm run dev
```

Then: submit the two required claims, watch all four surfaces stamp ADMITTED,
revoke one claim, watch them cascade to REFUSED, publish the evidence to Walrus,
then sign the ENS pointer with the embedded wallet.

## ENS configuration (Sepolia, live)

Reads (`resolver.text`, `resolver()`) run through viem's built-in ENS actions
server-side and need no key — only `SEPOLIA_RPC_URL`, which defaults to a public
endpoint. Reliable enough for dev; prefer a dedicated RPC for demo day.

The **evidence write is signed client-side by a Privy embedded wallet**, so no
signing key ever touches the server or `.env`. Set `NEXT_PUBLIC_PRIVY_APP_ID`
(free, from [dashboard.privy.io](https://dashboard.privy.io)) to enable the
"Publish to ENS" button; without it the app still runs and the Walrus upload
still works.

**The one manual pre-demo step:** the embedded wallet must be authorized to
write records for the name. Log in once, copy the embedded wallet address, and
approve it in the ENS Manager app — its owner/controller, or an account approved
via the registry's `setApprovalForAll` or the resolver's `approve()`. Also
confirm the deployed resolver actually implements `setText` for the `evidence`
key; a fully custom computed resolver may not accept writes at all.

Reads and the write both keep secrets out of the browser: reads go through
`/api/ens/read` server-side, and the write is signed by the user's own embedded
wallet rather than a shared key.

## Walrus configuration

Defaults to the public Walrus **testnet** publisher and aggregator. These need no
Sui wallet, no keypair, and no funds — testnet WAL has no monetary value.

```bash
# Optional overrides
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
WALRUS_EPOCHS=5
```

Walrus has no public mainnet publisher by design — a publisher spends real SUI
and WAL server-side. Testnet-only matches the team's Sepolia-only scope.

Uploads route through `/api/walrus` server-side rather than calling Walrus from
the browser, which avoids CORS entirely.

## Wiring in the remaining simulated pieces

1. Replace `lib/mock/chain.ts` with real reads against the deployed Identity,
   ClaimIssuer and EligibilityGate contracts. Keep the exported function
   signatures identical and nothing else needs to change.
2. Swap the simulated run log for real QA evidence — screenshots and the address
   table. If the bundle grows past **10 MiB**, the public publisher rejects it;
   compress or split across blobs.
3. Confirm the `evidence` text-record key with the team before demo day — it's
   their resolver, and `ENS_TEXT_KEY` in `EvidencePanel.tsx` is the one place to
   change it.

## Design notes

The subject is passport control, so the page is a passport data page: security
paper with a guilloché engraving, Bodoni Moda for headings (the didone lineage
used on banknotes and passports), Public Sans for body (the US government design
system face), IBM Plex Mono for addresses and the machine-readable zone. The
signature element is the rubber stamp — it slams down per surface on a stagger,
so refusal reads as one gesture rather than four badges changing colour.

Reduced motion is respected; the stamps appear without animating.

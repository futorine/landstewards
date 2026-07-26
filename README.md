# Landstewards

A land-stewardship registry built on ENS.

A land project is an **ENS name**. Its **stewardship slots are subnames** of that
name. Each slot's `steward` text record points at an individual steward's own ENS
username, and slots are reassignable when stewards leave or join — so the roster
lives on-chain, readable by anyone, with no database of record.

The signature view is a circle: **green stewards inside** the ring hold slots
(attested), **red stewards outside** are registered but not yet attested, and the
land sits in the centre.

```
                    ○ pending steward
        ╭───────────────────────╮
        │   ● ●   ┌───────┐     │   ● attested — holds slot-N.project.eth
        │         │ land  │  ●  │   ○ pending  — awaiting attestation
        │    ●    └───────┘     │
        ╰───────────────────────╯
              ○
```

## Quick start

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_PRIVY_APP_ID + NEXT_PUBLIC_ENS_NAME
npm run dev                        # serves over https (Privy needs a secure origin)
```

Then walk the demo: **register** a steward (appears red/outside) → open their
profile → toggle **admin** → **attest** → sign the record write → the record reads
back live from the resolver and their marker crosses inside the ring.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Stewards overview — the circle graphic, roster, registry log, Walrus evidence panel |
| `/register` | Register as a steward; enter your own ENS username (validated by a real resolver read) |
| `/stewards/[id]` | Steward profile; admin can attest (assign a slot) or transfer a slot — both real on-chain writes |
| `/admin` | Create a project — registers the ENSv2 name, mints its slot subnames, verifies both against the chain |

## What's real vs simulated

Stated in the UI and inside every published bundle, so nobody mistakes the
harness for a deployment.

| Component | Status |
| --- | --- |
| Steward roster, attestation state, slot occupancy | **Simulated** — in-memory (`lib/mock/land.ts`) |
| ENS reads (`text`, `resolver`) | **Live** — viem against Sepolia (`lib/ens.ts`) |
| Slot record writes (`setText` on a slot subname) | **Live** — wallet-signed (`lib/ens-write-client.ts`) |
| Project registration (`.eth` name + resolver + subregistry) | **Live** — ENSv2 commit/reveal, wallet-signed (`lib/ens-v2-register-client.ts`) |
| Slot subname minting (`register` on the project subregistry) | **Live** — wallet-signed ENSv2 write, gas only (`lib/ens-v2-write-client.ts`) |
| Walrus registry-evidence upload | **Live** — Sui testnet (`app/api/walrus/route.ts`) |

The roster is deliberately the *only* simulated part: function names in
`lib/mock/land.ts` mirror the intended contract calls, so swapping it for real
reads is a substitution rather than a rewrite.

## Configuration

```bash
NEXT_PUBLIC_ENS_NAME=landstewards.eth   # the project; slots derive as slot-N.<this>
NEXT_PUBLIC_PRIVY_APP_ID=…              # from dashboard.privy.io — enables on-chain writes
NEXT_PUBLIC_PRIVY_CLIENT_ID=…           # optional
SEPOLIA_RPC_URL=…                       # server-side reads; defaults to a public endpoint
```

Without `NEXT_PUBLIC_PRIVY_APP_ID` the app still runs — attestation falls back to
a local-only mock, so the demo flow stays intact.

## Docs

- **[docs/DEVELOPERS.md](docs/DEVELOPERS.md)** — architecture, data model, the ENS
  integration in detail, and the operator runbook for going live.


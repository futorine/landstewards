/**
 * ============================================================================
 * MOCK BOUNDARY
 * ============================================================================
 * Everything in this file is a simulation of contracts that live on Sepolia
 * in the real build: Identity, ClaimIssuer, EligibilityGate, and the ENS
 * read-through resolver. Nothing here touches a network.
 *
 * The function names and call graph deliberately match the real contracts,
 * so replacing this file with ethers.js calls is a substitution rather than
 * a rewrite:
 *
 *   ensText()      -> resolver.text(node, key)          [view]
 *   isEligible()   -> gate.isEligible(identity, policy) [view]
 *   isClaimValid() -> issuer.isClaimValid(...)          [view]
 *
 * The ONLY part of this project that is live is the Walrus upload —
 * see lib/walrus.ts and app/api/walrus/route.ts.
 * ============================================================================
 */

import type { ChainState, ClaimTopic, SurfaceId } from './types';

export const ADDRESSES = {
  identity: '0x7A2f4E1b9C8D3a05E6F1b24C9D8e3A0f5B6c7D81',
  claimIssuer: '0x3C9d1E7f2A4b8C05D6e9F0a1B2c3D4e5F6a7B8C9',
  eligibilityGate: '0xB1c2D3e4F5a6B7c8D9e0F1a2B3c4D5e6F7a8B9c0',
  gatedToken: '0x5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4f',
  resolver: '0x9F8e7D6c5B4a3928170615E4d3C2b1A09F8e7D6c',
  hook: '0x2A3b4C5d6E7f8091A2b3C4d5E6f70819A2b3C4d5',
} as const;

const ISSUER = ADDRESSES.claimIssuer;

export function initialState(): ChainState {
  return {
    wallet: '0xD4e5F6a7B8c9D0e1F2a3B4c5D6e7F8a9B0c1D2e3',
    identity: ADDRESSES.identity,
    ensName: process.env.NEXT_PUBLIC_ENS_NAME ?? 'demo.passportkit.eth',
    claims: {
      personhood: {
        topic: 'personhood',
        label: 'Proof of personhood',
        issuer: ISSUER,
        signature: '0x' + 'a3'.repeat(32),
        dataHash: '0x' + '7f'.repeat(16),
        attester: 'real', // World ID — a real integration in the live build
        addedAt: null,
      },
      kyc: {
        topic: 'kyc',
        label: 'KYC verified',
        issuer: ISSUER,
        signature: '0x' + 'b2'.repeat(32),
        dataHash: '0x' + '4c'.repeat(16),
        attester: 'mock', // labelled mock evidence attester
        addedAt: null,
      },
      accredited: {
        topic: 'accredited',
        label: 'Accredited investor',
        issuer: ISSUER,
        signature: '0x' + 'c1'.repeat(32),
        dataHash: '0x' + '9e'.repeat(16),
        attester: 'mock',
        addedAt: null,
      },
    },
    revoked: { personhood: false, kyc: false, accredited: false },
    policy: {
      id: 1,
      label: 'Policy #1 — verified human, KYC passed',
      requires: ['personhood', 'kyc'],
    },
  };
}

/* -------------------------------------------------------------------------- */
/* ClaimIssuer (view)                                                          */
/* -------------------------------------------------------------------------- */

/**
 * issuer.isClaimValid(identity, topic, sig, data)
 *
 * A claim is valid if the holder submitted it AND the issuer hasn't revoked
 * it. Revocation is checked live on every call — nothing is cached, which is
 * why one revocation flips every surface with no further transactions.
 */
export function isClaimValid(state: ChainState, topic: ClaimTopic): boolean {
  const claim = state.claims[topic];
  if (!claim.addedAt) return false;
  if (state.revoked[topic]) return false;
  return true;
}

/* -------------------------------------------------------------------------- */
/* EligibilityGate (view)                                                      */
/* -------------------------------------------------------------------------- */

/** gate.isEligible(identity, policyId) — the one question every surface asks. */
export function isEligible(state: ChainState): boolean {
  return state.policy.requires.every((topic) => isClaimValid(state, topic));
}

/** Which required claims are currently failing, for the operator view. */
export function failingClaims(state: ChainState): ClaimTopic[] {
  return state.policy.requires.filter((topic) => !isClaimValid(state, topic));
}

/* -------------------------------------------------------------------------- */
/* ENS read-through resolver (view)                                            */
/* -------------------------------------------------------------------------- */

/**
 * resolver.text(node, key)
 *
 * Stores nothing. Recomputes from the gate on every read, which is what
 * makes the name flip on revocation with no transaction against the
 * resolver, the identity, or the gate.
 */
export function ensText(state: ChainState, key: string): string {
  switch (key) {
    case 'status':
      return isEligible(state) ? 'GREEN' : 'RED';
    case 'policy':
      return `#${state.policy.id}`;
    case 'identity':
      return state.identity;
    default:
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* The four enforcement surfaces                                               */
/* -------------------------------------------------------------------------- */

export interface SurfaceReading {
  id: SurfaceId;
  name: string;
  contract: string;
  /** What this surface does when the gate says no. */
  refusal: string;
  admitted: boolean;
  note?: string;
}

export function readSurfaces(state: ChainState): SurfaceReading[] {
  const eligible = isEligible(state);

  return [
    {
      id: 'app',
      name: 'Gated app',
      contract: ADDRESSES.eligibilityGate,
      refusal: 'Entry refused',
      admitted: eligible,
    },
    {
      id: 'token',
      name: 'Permissioned ERC-20',
      contract: ADDRESSES.gatedToken,
      refusal: 'Transfer reverts',
      admitted: eligible,
      // From the spec: exits are always free, so a refused holder is never
      // trapped in the asset. Worth saying out loud in the demo.
      note: 'Exits stay open even when refused',
    },
    {
      id: 'hook',
      name: 'Uniswap v4 hook',
      contract: ADDRESSES.hook,
      refusal: 'Swap reverts',
      admitted: eligible,
      note: 'Proven by test suite, not live UI',
    },
    {
      id: 'ens',
      name: state.ensName,
      contract: ADDRESSES.resolver,
      refusal: 'Name reads RED',
      admitted: eligible,
      note: 'Recomputed per read — no transaction',
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * identity.addClaim(...) — submitted by the HOLDER, not the issuer.
 * The issuer only ever produces a signature off-chain; it has no write
 * access to this identity. That's the "no privileged writer" property.
 */
export function addClaim(state: ChainState, topic: ClaimTopic): ChainState {
  return {
    ...state,
    claims: {
      ...state.claims,
      [topic]: { ...state.claims[topic], addedAt: new Date().toISOString() },
    },
  };
}

/**
 * issuer.revokeClaim(...) — the issuer writes to its OWN contract.
 * It never touches the holder's identity. Every surface still flips,
 * because every surface re-reads rather than trusting a cached flag.
 */
export function revokeClaim(state: ChainState, topic: ClaimTopic): ChainState {
  return { ...state, revoked: { ...state.revoked, [topic]: true } };
}

export function reinstateClaim(state: ChainState, topic: ClaimTopic): ChainState {
  return { ...state, revoked: { ...state.revoked, [topic]: false } };
}

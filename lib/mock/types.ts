/**
 * Types mirroring the real contract shapes (ERC-734/735 style claims).
 * Everything here is a MOCK — see lib/mock/chain.ts for the boundary note.
 */

export type ClaimTopic = 'personhood' | 'kyc' | 'accredited';

export type SurfaceId = 'app' | 'token' | 'hook' | 'ens';

/** A claim as it exists on the Identity contract, once the holder submits it. */
export interface Claim {
  topic: ClaimTopic;
  label: string;
  /** Which attester signed it. */
  issuer: string;
  /** Issuer's signature over hash(identity, topic, data). Mocked. */
  signature: string;
  /** Hash or claim bit only — never PII. Matches the zero-PII-on-chain rule. */
  dataHash: string;
  /** Whether this attester is a real integration or a labelled mock. */
  attester: 'real' | 'mock';
  /** null until the holder submits it themselves via addClaim(). */
  addedAt: string | null;
}

export interface Policy {
  id: number;
  label: string;
  /** All of these claims must be valid for isEligible() to return true. */
  requires: ClaimTopic[];
}

export interface ChainState {
  wallet: string;
  identity: string;
  ensName: string;
  claims: Record<ClaimTopic, Claim>;
  /**
   * Revocations live on the ClaimIssuer's OWN contract, never on the
   * holder's identity. This is the whole point: the issuer writes once,
   * to a contract they control, and every downstream read changes.
   */
  revoked: Record<ClaimTopic, boolean>;
  policy: Policy;
}

export interface LogEntry {
  at: string;
  actor: 'issuer' | 'holder' | 'verifier';
  action: string;
  detail: string;
  /** isEligible() as read immediately after this action. */
  eligibleAfter: boolean;
}

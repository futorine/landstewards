import { ADDRESSES, isEligible, readSurfaces, ensText } from './mock/chain';
import type { ChainState, LogEntry } from './mock/types';

export interface EvidenceBundle {
  schema: 'zk-credential-attestor-node/evidence@1';
  generatedAt: string;
  network: string;
  subject: {
    wallet: string;
    identity: string;
    ensName: string;
    policy: { id: number; label: string; requires: string[] };
  };
  addressTable: { name: string; address: string }[];
  /** Every action taken during the run, with the gate reading after each. */
  log: LogEntry[];
  /** What each surface answered at the moment of capture. */
  finalReadings: {
    isEligible: boolean;
    ensTextStatus: string;
    surfaces: { name: string; admitted: boolean; behaviourWhenRefused: string }[];
  };
  /**
   * Shipped inside the bundle on purpose. The team's rule is no overclaims,
   * so the artifact states its own limits rather than relying on someone
   * reading the README.
   */
  provenance: {
    upstreamSimulated: true;
    note: string;
    liveComponents: string[];
  };
}

export function buildEvidenceBundle(
  state: ChainState,
  log: LogEntry[]
): EvidenceBundle {
  const surfaces = readSurfaces(state);

  return {
    schema: 'zk-credential-attestor-node/evidence@1',
    generatedAt: new Date().toISOString(),
    network: 'simulated (mirrors Ethereum Sepolia deployment)',
    subject: {
      wallet: state.wallet,
      identity: state.identity,
      ensName: state.ensName,
      policy: {
        id: state.policy.id,
        label: state.policy.label,
        requires: [...state.policy.requires],
      },
    },
    addressTable: Object.entries(ADDRESSES).map(([name, address]) => ({
      name,
      address,
    })),
    log,
    finalReadings: {
      isEligible: isEligible(state),
      ensTextStatus: ensText(state, 'status'),
      surfaces: surfaces.map((s) => ({
        name: s.name,
        admitted: s.admitted,
        behaviourWhenRefused: s.refusal,
      })),
    },
    provenance: {
      upstreamSimulated: true,
      note:
        'Identity, ClaimIssuer, EligibilityGate and the ENS resolver are simulated ' +
        'in this harness. Contract call graph and claim structure mirror the ' +
        'Sepolia deployment, but no chain reads occurred. The Walrus upload that ' +
        'produced this blob is live.',
      liveComponents: ['Walrus blob storage (Sui testnet)'],
    },
  };
}

/** Pretty-printed so a judge opening the blob URL can read it directly. */
export function serializeBundle(bundle: EvidenceBundle): string {
  return JSON.stringify(bundle, null, 2);
}

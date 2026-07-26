import {
  attestedStewards,
  pendingStewards,
  slotsFilled,
  slotSubname,
  stewardById,
  type LandState,
} from './mock/land';

/**
 * A content-addressed snapshot of the stewardship registry, published to
 * Walrus so anyone can audit the roster and slot assignments at source. The
 * roster is simulated; the slot subname records referenced here are written
 * for real on ENS — the bundle says so itself rather than overclaiming.
 */
export interface EvidenceBundle {
  schema: 'landstewards/evidence@1';
  generatedAt: string;
  network: string;
  project: {
    ensName: string;
    displayName: string;
    location: string;
    hectares: number;
    maxSlots: number;
  };
  slots: {
    subname: string;
    steward: { displayName: string; ensName: string } | null;
  }[];
  stewards: {
    displayName: string;
    ensName: string;
    role: string;
    status: 'pending' | 'attested';
  }[];
  totals: { slotsFilled: number; attested: number; pending: number };
  provenance: {
    upstreamSimulated: true;
    note: string;
    liveComponents: string[];
  };
}

export function buildEvidenceBundle(state: LandState): EvidenceBundle {
  const { project } = state;

  return {
    schema: 'landstewards/evidence@1',
    generatedAt: new Date().toISOString(),
    network: 'ENS on Sepolia (live records) + simulated roster',
    project: {
      ensName: project.ensName,
      displayName: project.displayName,
      location: project.location,
      hectares: project.hectares,
      maxSlots: project.maxSlots,
    },
    slots: state.slots.map((slot) => {
      const s = slot.stewardId ? stewardById(state, slot.stewardId) : null;
      return {
        subname: slotSubname(project, slot.index),
        steward: s ? { displayName: s.displayName, ensName: s.ensName } : null,
      };
    }),
    stewards: state.stewards.map((s) => ({
      displayName: s.displayName,
      ensName: s.ensName,
      role: s.role,
      status: s.status,
    })),
    totals: {
      slotsFilled: slotsFilled(state),
      attested: attestedStewards(state).length,
      pending: pendingStewards(state).length,
    },
    provenance: {
      upstreamSimulated: true,
      note:
        'The steward roster and attestation state are simulated in this harness. ' +
        'The slot subname records (each slot subname’s "steward" text record) ' +
        'are written for real on ENS (Sepolia) and can be read back off the ' +
        'resolver. The Walrus upload that produced this blob is also live.',
      liveComponents: [
        'ENS slot subname records (Sepolia)',
        'Walrus blob storage (Sui testnet)',
      ],
    },
  };
}

/** Pretty-printed so a judge opening the blob URL can read it directly. */
export function serializeBundle(bundle: EvidenceBundle): string {
  return JSON.stringify(bundle, null, 2);
}

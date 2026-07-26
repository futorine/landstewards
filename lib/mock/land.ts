/**
 * ============================================================================
 * MOCK BOUNDARY
 * ============================================================================
 * The steward roster, slot occupancy and attestation state below are a
 * SIMULATION of what would live on-chain in the real build. Nothing in this
 * file touches a network.
 *
 * The one thing that IS live is the slot → steward pointer: each stewardship
 * slot is an ENSv2 subname whose `steward` text record points at the
 * steward's own ENS username. Assigning/transferring a slot writes that
 * record for real (signed by a Privy embedded wallet — see
 * lib/ens-write-client.ts), and reads come straight back off the resolver
 * (lib/ens.ts). ENSv2 keeps resolvers unchanged, so the same setText/getText
 * seam used before carries over untouched.
 *
 * Function names mirror the intended contract calls so swapping the mock for
 * real reads is a substitution, not a rewrite.
 * ============================================================================
 */

export type StewardStatus = 'pending' | 'attested';

export interface LandProject {
  /** Parent ENSv2 name on Sepolia — the land project itself. */
  ensName: string;
  displayName: string;
  location: string;
  hectares: number;
  /** One-line description of the stewardship mandate. */
  mandate: string;
  /** Predefined stewardship slots for the demo. */
  maxSlots: number;
}

export interface Steward {
  id: string;
  displayName: string;
  /** The steward's own ENS username (personal identity). */
  ensName: string;
  role: string;
  bio: string;
  walletAddress: string;
  status: StewardStatus;
  /** Deterministic seed for the generated avatar. */
  avatarSeed: string;
  registeredAt: string;
}

export interface Slot {
  /** 0-based; the subname is `slot-${index + 1}.<project ens>`. */
  index: number;
  stewardId: string | null;
}

export interface LandLogEntry {
  at: string;
  actor: 'steward' | 'project';
  action: string;
  detail: string;
}

export interface LandState {
  project: LandProject;
  stewards: Steward[];
  slots: Slot[];
  log: LandLogEntry[];
}

/* -------------------------------------------------------------------------- */
/* ENS naming                                                                  */
/* -------------------------------------------------------------------------- */

/** The ENSv2 subname backing a slot, e.g. `slot-3.<project>.eth`. */
export function slotSubname(project: LandProject, index: number): string {
  return `slot-${index + 1}.${project.ensName}`;
}

/** The text-record key on a slot subname that points at the steward. */
export const SLOT_STEWARD_KEY = 'steward';

/* -------------------------------------------------------------------------- */
/* Reads (mirror view calls)                                                   */
/* -------------------------------------------------------------------------- */

export function stewardById(state: LandState, id: string): Steward | undefined {
  return state.stewards.find((s) => s.id === id);
}

export function attestedStewards(state: LandState): Steward[] {
  return state.stewards.filter((s) => s.status === 'attested');
}

export function pendingStewards(state: LandState): Steward[] {
  return state.stewards.filter((s) => s.status === 'pending');
}

export function slotsFilled(state: LandState): number {
  return state.slots.filter((s) => s.stewardId !== null).length;
}

/** The slot a steward currently holds, or null if unseated. */
export function slotForSteward(state: LandState, stewardId: string): Slot | null {
  return state.slots.find((s) => s.stewardId === stewardId) ?? null;
}

/** Lowest-index empty slot, or null when the project is full. */
export function firstFreeSlot(state: LandState): Slot | null {
  return state.slots.find((s) => s.stewardId === null) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Writes (mirror the contract calls; pure — return new state)                 */
/* -------------------------------------------------------------------------- */

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `stw_${Date.now().toString(36)}_${idCounter}`;
}

function log(
  state: LandState,
  entry: Omit<LandLogEntry, 'at'>
): LandLogEntry[] {
  return [...state.log, { ...entry, at: new Date().toISOString() }];
}

export interface RegisterInput {
  displayName: string;
  ensName: string;
  role: string;
  bio: string;
  walletAddress: string;
}

/** A steward registers themselves — enters the roster as pending (red/outside). */
export function registerSteward(
  state: LandState,
  input: RegisterInput
): { state: LandState; steward: Steward } {
  const steward: Steward = {
    id: nextId(),
    displayName: input.displayName,
    ensName: input.ensName,
    role: input.role,
    bio: input.bio,
    walletAddress: input.walletAddress,
    status: 'pending',
    avatarSeed: input.ensName || input.displayName,
    registeredAt: new Date().toISOString(),
  };
  return {
    steward,
    state: {
      ...state,
      stewards: [...state.stewards, steward],
      log: log(state, {
        actor: 'steward',
        action: 'registry.register',
        detail: `${input.displayName} registered as ${input.ensName}, awaiting attestation.`,
      }),
    },
  };
}

/**
 * The project attests a pending steward and seats them in the lowest free
 * slot. This is the moment that (in the live path) writes the slot subname's
 * `steward` text record on-chain.
 */
export function attestSteward(
  state: LandState,
  stewardId: string
): LandState {
  const steward = stewardById(state, stewardId);
  const free = firstFreeSlot(state);
  if (!steward || steward.status === 'attested' || !free) return state;

  return {
    ...state,
    stewards: state.stewards.map((s) =>
      s.id === stewardId ? { ...s, status: 'attested' } : s
    ),
    slots: state.slots.map((slot) =>
      slot.index === free.index ? { ...slot, stewardId } : slot
    ),
    log: log(state, {
      actor: 'project',
      action: 'registry.attest',
      detail: `${steward.displayName} attested and seated in ${slotSubname(
        state.project,
        free.index
      )}.`,
    }),
  };
}

/**
 * Reassign a slot to a different steward — the "leaver → joiner" transfer.
 * The outgoing steward is released back to pending; the incoming one is
 * attested into the slot.
 */
export function transferSlot(
  state: LandState,
  slotIndex: number,
  newStewardId: string
): LandState {
  const slot = state.slots.find((s) => s.index === slotIndex);
  const incoming = stewardById(state, newStewardId);
  if (!slot || !incoming) return state;

  const outgoingId = slot.stewardId;

  return {
    ...state,
    stewards: state.stewards.map((s) => {
      if (s.id === newStewardId) return { ...s, status: 'attested' };
      if (s.id === outgoingId) return { ...s, status: 'pending' };
      return s;
    }),
    // The incoming steward may already sit in another slot; vacate it.
    slots: state.slots.map((sl) => {
      if (sl.index === slotIndex) return { ...sl, stewardId: newStewardId };
      if (sl.stewardId === newStewardId) return { ...sl, stewardId: null };
      return sl;
    }),
    log: log(state, {
      actor: 'project',
      action: 'registry.transferSlot',
      detail: `${slotSubname(state.project, slotIndex)} transferred to ${
        incoming.displayName
      }${outgoingId ? ` (released ${stewardById(state, outgoingId)?.displayName ?? 'previous steward'})` : ''}.`,
    }),
  };
}

/** Vacate a slot — the steward leaves and returns to pending. */
export function releaseSlot(state: LandState, slotIndex: number): LandState {
  const slot = state.slots.find((s) => s.index === slotIndex);
  if (!slot || slot.stewardId === null) return state;
  const leaving = stewardById(state, slot.stewardId);

  return {
    ...state,
    stewards: state.stewards.map((s) =>
      s.id === slot.stewardId ? { ...s, status: 'pending' } : s
    ),
    slots: state.slots.map((sl) =>
      sl.index === slotIndex ? { ...sl, stewardId: null } : sl
    ),
    log: log(state, {
      actor: 'project',
      action: 'registry.releaseSlot',
      detail: `${slotSubname(state.project, slotIndex)} released${
        leaving ? ` by ${leaving.displayName}` : ''
      }.`,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Seed                                                                        */
/* -------------------------------------------------------------------------- */

// Fallback must be a name that actually exists, or a fresh clone with no
// .env.local renders slots that can never resolve. /admin prints the value to
// set here for your own project.
const PARENT = process.env.NEXT_PUBLIC_ENS_NAME ?? 'landstewards.eth';

/** Demo seed: a populated project so the circle reads well on first paint. */
export function initialLandState(): LandState {
  const project: LandProject = {
    ensName: PARENT,
    displayName: 'Ocean Reef Commons',
    location: 'Ilha do Pico, Azores',
    hectares: 240,
    mandate: 'Regenerate the coastal reef terraces and the vineyard drystone walls.',
    // Match the number of slot subnames actually created on-chain
    // (slot-1..slot-N.landstewards.eth). Bump to 10 once the rest exist.
    maxSlots: 4,
  };

  // One founding steward for the demo — seated in slot-1, green/inside. New
  // registrations arrive red/outside and get attested into slots 2..4 live.
  const seed: Array<Omit<Steward, 'id'> & { id: string }> = [
    {
      id: 'stw_seed_1',
      displayName: 'Mara Silveira',
      ensName: 'mara.eth',
      role: 'Reef warden',
      bio: 'Marine biologist coordinating the reef-terrace restoration.',
      walletAddress: '0xA1b2C3d4E5f6a7B8c9D0e1F2a3B4c5D6e7F8a9B0',
      status: 'attested',
      avatarSeed: 'mara.eth',
      registeredAt: '2026-05-02T09:00:00.000Z',
    },
  ];

  const slots: Slot[] = Array.from({ length: project.maxSlots }, (_, index) => ({
    index,
    stewardId: null,
  }));
  // Seat the founding steward in slot-1.
  slots[0].stewardId = 'stw_seed_1';

  return {
    project,
    stewards: seed,
    slots,
    log: [
      {
        at: '2026-05-09T14:15:00.000Z',
        actor: 'project',
        action: 'registry.attest',
        detail: `Founding steward seated. ${project.maxSlots - 1} slots open.`,
      },
    ],
  };
}

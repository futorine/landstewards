import { NextResponse } from 'next/server';
import { readEnsText } from '@/lib/ens';
import { findSubregistry, readSlotState } from '@/lib/ens-v2';
import { SLOT_STEWARD_KEY } from '@/lib/mock/land';

/**
 * Verifies that a project is really provisioned on ENSv2: the parent has a
 * subregistry, and each expected slot subname is actually registered in it.
 *
 * Existence comes from the subregistry's getState(), NOT from a resolver
 * lookup. An earlier version of this route checked "does the name resolve to
 * a non-zero resolver?" and reported EVERY name as ready — ENSv2 wildcard
 * resolution returns the parent's resolver for any unregistered subname, so
 * even `totally-made-up.landstewards.eth` passed. A verifier that approves
 * everything is worse than none, hence the switch to registry state.
 *
 * Read-only, so no wallet is needed.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  const slots = Math.max(0, Math.min(20, Number(searchParams.get('slots') ?? 0)));

  if (!name) {
    return NextResponse.json(
      { error: 'name query param is required' },
      { status: 400 }
    );
  }

  try {
    const subregistry = await findSubregistry(name);

    // No subregistry means subnames cannot exist yet — report that plainly
    // rather than reporting every slot as individually missing.
    if (!subregistry) {
      return NextResponse.json({
        name,
        subregistry: null,
        parent: { resolves: false, subregistry: null },
        slots: [],
        slotsReady: 0,
        slotsRequested: slots,
        recordKey: SLOT_STEWARD_KEY,
        hint: `${name} has no ENSv2 subregistry, so stewardship slots cannot be created under it yet.`,
      });
    }

    const slotResults = [];
    for (let i = 0; i < slots; i += 1) {
      const label = `slot-${i + 1}`;
      const subname = `${label}.${name}`;
      const state = await readSlotState(subregistry, label);

      let steward: string | null = null;
      if (state.exists) {
        try {
          steward = await readEnsText(subname, SLOT_STEWARD_KEY);
        } catch {
          steward = null;
        }
      }

      slotResults.push({
        index: i,
        label,
        subname,
        exists: state.exists,
        owner: state.owner,
        resolver: state.resolver,
        expiry: state.expiry ? state.expiry.toString() : null,
        steward,
      });
    }

    const ready = slotResults.filter((s) => s.exists).length;

    return NextResponse.json({
      name,
      subregistry,
      parent: { resolves: true, subregistry },
      slots: slotResults,
      slotsReady: ready,
      slotsRequested: slots,
      recordKey: SLOT_STEWARD_KEY,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

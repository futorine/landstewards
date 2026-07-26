'use client';

import Link from 'next/link';
import {
  attestedStewards,
  pendingStewards,
  slotsFilled,
  type LandState,
} from '@/lib/mock/land';
import PersonIcon from './PersonIcon';
import LandScene from './LandScene';

/**
 * The signature graphic. A ring whose fill tracks seated slots, with
 * attested stewards as green markers ON/INSIDE the ring and pending stewards
 * as red markers OUTSIDE it. The fictional land sits in the centre with the
 * project name. Markers are positioned by polar coordinates in percentages
 * so the whole thing scales, and a status change animates a marker crossing
 * the ring because every steward is rendered from one keyed list.
 */

// Radii as a percentage of the (square) container's half-width.
const R_INNER = 31; // attested markers, just inside the ring
const R_RING = 37; // the ring itself
const R_OUTER = 47; // pending markers, outside the ring
const RING_STROKE = 2.5; // in the 0..100 viewBox

interface Placed {
  angle: number; // radians
  radius: number; // percent
  attested: boolean;
}

function placements(state: LandState): Map<string, Placed> {
  const map = new Map<string, Placed>();
  const attested = attestedStewards(state);
  const pending = pendingStewards(state);

  const ring = (count: number, i: number, offset = 0) =>
    (-Math.PI / 2) + offset + (count > 0 ? (2 * Math.PI * i) / count : 0);

  attested.forEach((s, i) =>
    map.set(s.id, { angle: ring(attested.length, i), radius: R_INNER, attested: true })
  );
  pending.forEach((s, i) =>
    // offset the outer ring so pending markers don't sit directly radial to
    // the attested ones
    map.set(s.id, {
      angle: ring(pending.length, i, Math.PI / Math.max(pending.length, 6)),
      radius: R_OUTER,
      attested: false,
    })
  );
  return map;
}

export default function StewardCircle({ state }: { state: LandState }) {
  const { project } = state;
  const filled = slotsFilled(state);
  const fraction = project.maxSlots === 0 ? 0 : filled / project.maxSlots;

  const r = R_RING;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - fraction);

  const placed = placements(state);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      {/* Ring */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          className="stroke-ink/12"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          pathLength={circumference}
          className="stroke-admit"
          style={{
            transition: 'stroke-dashoffset 600ms cubic-bezier(0.2, 0.8, 0.3, 1)',
          }}
        />
      </svg>

      {/* Centre: the fictional land + name */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-foil/70 shadow-lg">
        <LandScene className="h-full w-full" />
        <div className="absolute inset-x-0 bottom-0 bg-ink/75 px-2 py-1 text-center backdrop-blur-sm">
          <p className="truncate font-display text-[11px] font-black uppercase leading-tight tracking-[0.08em] text-paper">
            {project.displayName}
          </p>
        </div>
      </div>

      {/* Steward markers */}
      {state.stewards.map((s) => {
        const p = placed.get(s.id);
        if (!p) return null;
        const left = 50 + p.radius * Math.cos(p.angle);
        const top = 50 + p.radius * Math.sin(p.angle);
        return (
          <Link
            key={s.id}
            href={`/stewards/${s.id}`}
            title={`${s.displayName} · ${s.ensName} · ${
              p.attested ? 'attested' : 'pending'
            }`}
            className={[
              'group absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-1.5 shadow',
              p.attested
                ? 'border-admit/60 bg-admit/15 text-admit'
                : 'border-refuse/60 bg-refuse/15 text-refuse',
            ].join(' ')}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              transition:
                'left 600ms cubic-bezier(0.2,0.8,0.3,1), top 600ms cubic-bezier(0.2,0.8,0.3,1), color 300ms, background-color 300ms, border-color 300ms',
            }}
          >
            <PersonIcon size={22} title={s.displayName} />
          </Link>
        );
      })}
    </div>
  );
}

'use client';

import Stamp from './Stamp';
import EnsTag from './EnsTag';
import type { SurfaceReading } from '@/lib/mock/chain';

interface Props {
  surface: SurfaceReading;
  index: number;
  generation: number;
}

export default function SurfaceCard({ surface, index, generation }: Props) {
  return (
    <div className="relative rounded-2xl border border-ink/15 bg-paper/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/60">
            Surface {String(index + 1).padStart(2, '0')}
          </p>
          <h3 className="mt-1 flex items-center gap-2 truncate font-display text-lg font-bold">
            {surface.name}
            {surface.id === 'ens' && <EnsTag />}
          </h3>
          <p className="mt-1 truncate font-mono text-[11px] font-medium text-ink/65">
            {surface.contract}
          </p>
        </div>

        <div className="shrink-0">
          <Stamp
            kind={surface.admitted ? 'admitted' : 'refused'}
            index={index}
            generation={generation}
            size="sm"
          />
        </div>
      </div>

      <div className="mt-4 border-t border-dashed border-ink/15 pt-3">
        <p className="text-sm font-semibold">
          {surface.admitted ? (
            <span className="text-ink/85">Passing traffic.</span>
          ) : (
            <span className="font-bold text-refuse">{surface.refusal}.</span>
          )}
        </p>
        {surface.note && (
          <p className="mt-1 text-xs font-medium leading-relaxed text-ink/65">{surface.note}</p>
        )}
      </div>
    </div>
  );
}

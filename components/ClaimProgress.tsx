'use client';

/**
 * The seal: a ring that fills one arc-length per valid required claim.
 * Submitting a claim grows it, revoking one shrinks it back — the same
 * stroke-dashoffset transition runs both directions.
 */

interface Props {
  current: number;
  total: number;
  eligible: boolean;
}

const SIZE = 176;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ClaimProgress({ current, total, eligible }: Props) {
  const fraction = total === 0 ? 0 : Math.min(current / total, 1);
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-ink/12"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className={eligible ? 'stroke-admit' : 'stroke-foil'}
            style={{
              transition:
                'stroke-dashoffset 550ms cubic-bezier(0.2, 0.8, 0.3, 1), stroke 300ms ease-out',
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-black tabular-nums">
            {current}
            <span className="text-ink/55">/{total}</span>
          </span>
          <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink/60">
            Claims verified
          </span>
        </div>
      </div>

      <p
        className={[
          'font-mono text-[10px] font-bold uppercase tracking-[0.2em]',
          eligible ? 'text-admit' : 'text-foil',
        ].join(' ')}
      >
        {eligible ? 'Gate open' : `${total - current} claim${total - current === 1 ? '' : 's'} remaining`}
      </p>
    </div>
  );
}

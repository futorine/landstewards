'use client';

/**
 * The signature element. A rubber stamp coming down on the document.
 * Every instance sits at its own angle so a grid of them never reads
 * as a row of identical badges.
 */

interface StampProps {
  kind: 'admitted' | 'refused';
  /** Drives the stagger so the cascade reads as one gesture, not four. */
  index?: number;
  /** Changing this key restarts the slam animation. */
  generation: number;
  size?: 'sm' | 'lg';
}

const ANGLES = [-7, 5, -3, 8, -5];

export default function Stamp({
  kind,
  index = 0,
  generation,
  size = 'lg',
}: StampProps) {
  const refused = kind === 'refused';
  const angle = ANGLES[index % ANGLES.length];

  return (
    <div
      key={`${kind}-${generation}`}
      className="animate-stamp ink-blend pointer-events-none select-none"
      style={
        {
          '--stamp-rot': `${angle}deg`,
          animationDelay: `${index * 90}ms`,
        } as React.CSSProperties
      }
    >
      <div
        className={[
          'inline-flex items-center justify-center rounded-md border-[3px] font-display font-black uppercase',
          refused ? 'border-refuse text-refuse' : 'border-admit text-admit',
          size === 'lg'
            ? 'px-5 py-1.5 text-2xl tracking-[0.18em]'
            : 'px-3 py-1 text-sm tracking-[0.14em]',
        ].join(' ')}
        style={{ opacity: 0.95 }}
      >
        {refused ? 'Refused' : 'Admitted'}
      </div>
    </div>
  );
}

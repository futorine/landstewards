/**
 * A fictional land vignette drawn entirely inline — no external asset, no
 * network. Its own warm palette (it's a picture, not chrome) so it pops
 * against the dark passport surface. Fills its square container.
 */
export default function LandScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe0e6" />
          <stop offset="100%" stopColor="#eaddc4" />
        </linearGradient>
        <linearGradient id="ls-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f9aa6" />
          <stop offset="100%" stopColor="#1f6b74" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="100" height="100" fill="url(#ls-sky)" />
      {/* Sun */}
      <circle cx="72" cy="26" r="11" fill="#e6b64c" />
      {/* Far hills */}
      <path d="M0 52 Q20 40 40 48 T80 44 T100 50 V70 H0 Z" fill="#7ba05b" />
      {/* Near terraced ridge */}
      <path d="M0 62 Q26 50 52 60 T100 58 V100 H0 Z" fill="#4f7a3f" />
      {/* Terrace lines */}
      <path d="M6 70 Q40 62 96 68" fill="none" stroke="#3d6231" strokeWidth="1.2" opacity="0.7" />
      <path d="M2 78 Q44 71 98 76" fill="none" stroke="#3d6231" strokeWidth="1.2" opacity="0.6" />
      {/* Water inlet */}
      <path d="M0 84 Q30 80 60 86 T100 84 V100 H0 Z" fill="url(#ls-water)" />
    </svg>
  );
}

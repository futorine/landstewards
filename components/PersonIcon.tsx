/**
 * A single person marker for the steward circle — head + shoulders in a
 * rounded chip. Colour is driven by the caller (admit = attested/inside,
 * refuse = pending/outside) via currentColor.
 */
export default function PersonIcon({
  size = 26,
  title,
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7v.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5V20z" />
    </svg>
  );
}

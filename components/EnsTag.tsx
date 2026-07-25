/** Small badge marking a value that's read from (or written to) ENS. */
export default function EnsTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-foil/50 bg-foil/10 px-1.5 py-[1px] font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-foil">
      ENS
    </span>
  );
}

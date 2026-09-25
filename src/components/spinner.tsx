/**
 * A small spinning mark for work in progress. Decorative: the words beside it
 * (or `label`, read by assistive technology) say what is happening, and it
 * stops spinning for people who ask for reduced motion.
 */
export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`spinner ${className}`.trim()} role={label ? "status" : undefined}>
      <span className="spinner__mark" aria-hidden="true" />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </span>
  );
}

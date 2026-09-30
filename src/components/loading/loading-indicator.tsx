/**
 * The small "page on its way" badge: a revolver cylinder turning, with the
 * words beside it. Sits at the bottom of the screen above whatever is loading,
 * never over it. Stays invisible for the first 150 ms, so a page that arrives
 * quickly never flashes it, then turns for as long as the page takes.
 *
 * The drawing is provisional (a plain cylinder face); the pixel-art revolver
 * replaces `.loading-indicator__cylinder` without changing this component.
 */
export function LoadingIndicator({ label = "Loading the page" }: { readonly label?: string }) {
  return (
    <div className="loading-indicator" role="status" data-testid="loading-indicator">
      <span className="loading-indicator__cylinder" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="loading-indicator__chamber" />
        ))}
      </span>
      <span className="loading-indicator__label">{label}…</span>
    </div>
  );
}

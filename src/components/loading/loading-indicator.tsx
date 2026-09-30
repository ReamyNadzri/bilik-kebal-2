/**
 * The "page on its way" loader: the page dims behind a light blur and a
 * pixel-art revolver reloads in the middle. The words are for screen readers
 * only.
 * Stays invisible for the first 150 ms, so a page that arrives quickly never
 * flashes it, then loops for as long as the page takes. Clicks pass through
 * the backdrop, so navigation still works.
 *
 * The revolver is an original sprite (public/brand/revolver-reload.png, drawn
 * in scripts/revolver-art); reduced motion shows its first frame, still.
 */
export function LoadingIndicator({ label = "Loading the page" }: { readonly label?: string }) {
  return (
    <div className="loading-indicator" role="status" data-testid="loading-indicator">
      <span className="loading-indicator__revolver" aria-hidden="true" />
      <span className="visually-hidden">{label}…</span>
    </div>
  );
}

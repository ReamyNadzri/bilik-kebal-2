import type { StatusPresentation } from "@/features/marketplace/status";

export interface StatusStampProps {
  readonly presentation: StatusPresentation;
  /**
   * What the status belongs to, for example "Wanted" or "Claim". Rendered for
   * assistive technology so a stamp is never announced as a bare adjective in
   * a list of other bare adjectives.
   */
  readonly context?: string;
}

/**
 * A lifecycle state, presented as a stamped mark.
 *
 * Purely presentational: it renders the words and treatment it is handed and
 * knows no lifecycle rule. Tone is accompanied by a border treatment and
 * always by the word itself, so the state survives greyscale.
 */
export function StatusStamp({ presentation, context }: StatusStampProps) {
  const { label, tone, emphasis } = presentation;

  return (
    <span className={`status-stamp status-stamp--${tone} status-stamp--${emphasis}`}>
      {context === undefined ? null : (
        <span className="visually-hidden">{`${context} status:`}</span>
      )}
      {label}
    </span>
  );
}

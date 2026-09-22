"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUploadField } from "./file-upload-field";
import { EvidenceLocker, type EvidenceItem } from "./evidence-locker";
import { DispatchAlertToast } from "./dispatch-alert-toast";
import type { CompletedClaimProof } from "@/contracts/claims";

export interface ClaimSubmissionWorkspaceProps {
  readonly wantedId: string;
  readonly initialEvidence?: readonly EvidenceItem[];
  readonly returnTo?: string;
  readonly returnLabel?: string;
}

interface ToastAlertState {
  readonly title: string;
  readonly message: string;
  readonly tier: "info" | "success" | "warning" | "error";
  readonly badgeLabel?: string;
}

export function ClaimSubmissionWorkspace({
  wantedId,
  initialEvidence = [],
  returnTo,
  returnLabel,
}: ClaimSubmissionWorkspaceProps) {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([...initialEvidence]);
  const [toastAlert, setToastAlert] = useState<ToastAlertState | null>(null);

  const handleUploadComplete = (proof: CompletedClaimProof) => {
    const newEvidence: EvidenceItem = {
      id: proof.claimId,
      claimId: proof.claimId,
      actionType: "Claim Proof",
      fileName: proof.fileName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      uploadedAt: proof.completedAt,
      status: proof.status,
    };
    setEvidenceList((prev) => [newEvidence, ...prev]);

    // Dispatch event notification alert
    setToastAlert({
      title: "Proof Dispatched to Quarantine",
      message: `"${proof.fileName}" has been verified and queued for automated screening.`,
      tier: "info",
      badgeLabel: "DISPATCH EVENT",
    });
  };

  const handleRemoveProof = (proof: CompletedClaimProof) => {
    setEvidenceList((prev) => prev.filter((item) => item.claimId !== proof.claimId));
    setToastAlert({
      title: "Proof Retracted",
      message: `"${proof.fileName}" has been removed from this bounty claim.`,
      tier: "warning",
      badgeLabel: "STATUS UPDATE",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.75rem",
        maxWidth: "52rem",
        marginInline: "auto",
        width: "100%",
      }}
    >
      {/* Masthead Banner */}
      <header
        className="panel"
        style={{
          borderRadius: "4px",
          padding: "1.5rem 1.75rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <p className="pixel-label" style={{ marginBottom: "0.35rem" }}>
            Bounty Hunter · Fulfill Bounty Desk
          </p>
          <h1
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: "1.75rem",
              color: "var(--text-primary, #2a2118)",
            }}
          >
            Fulfill Bounty
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              color: "var(--text-muted, #5e4f37)",
            }}
          >
            Upload academic resource proof to claim and fulfill this bounty request.
          </p>
        </div>

        <Link
          href={returnTo ?? `/claims`}
          className="button button--secondary"
          style={{ whiteSpace: "nowrap" }}
        >
          {returnLabel ?? "← Back to Hunt"}
        </Link>
      </header>

      {/* 1. File Upload Field */}
      <section aria-labelledby="upload-section-heading">
        <h2 id="upload-section-heading" className="visually-hidden">
          Attach Proof Files
        </h2>
        <FileUploadField
          wantedId={wantedId}
          onUploadComplete={handleUploadComplete}
          onRemoveProof={handleRemoveProof}
        />
      </section>

      {/* 2. Evidence Locker */}
      <section aria-labelledby="evidence-locker-heading">
        <EvidenceLocker
          title="Evidence Locker"
          subtitle="All attached proof files and screening records for this bounty claim."
          evidence={evidenceList}
          onRemoveEvidence={(item) =>
            setEvidenceList((prev) => prev.filter((e) => e.id !== item.id))
          }
        />
      </section>

      {/* 3. Floating Event-Driven Dispatch Toast Alert */}
      {toastAlert && (
        <DispatchAlertToast
          title={toastAlert.title}
          message={toastAlert.message}
          tier={toastAlert.tier}
          badgeLabel={toastAlert.badgeLabel}
          onDismiss={() => setToastAlert(null)}
        />
      )}
    </div>
  );
}

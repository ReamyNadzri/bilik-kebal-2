import type { VerificationQueueItem } from "@/contracts";

/**
 * Builder for the Codex-published `VerificationQueueItem`.
 *
 * Test support only. Production code must never import this module.
 *
 * Built from the published contract type, so if Codex ever added a storage key
 * to the queue shape these tests would fail to compile rather than silently
 * start rendering one.
 */
export function aQueueItem(overrides: Partial<VerificationQueueItem> = {}): VerificationQueueItem {
  return {
    requestId: "3f1d0c2e-1111-4111-8111-111111111111",
    institutionId: "11111111-1111-4111-8111-111111111111",
    institutionName: "UiTM Shah Alam",
    applicantDisplayName: "Aisyah Rahman",
    state: "pending",
    submittedAt: "2026-09-10T08:00:00.000Z",
    evidenceDeleteAfter: "2026-10-10T08:00:00.000Z",
    ...overrides,
  };
}

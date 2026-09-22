import type {
  CreateWantedDraftResult,
  MarketplaceOperationCode,
  PrepareWantedPublicationResult,
  SuggestWantedDuplicatesResult,
  WantedDraftInput,
  WantedDraftView,
  WantedDuplicateSuggestion,
} from "@/contracts/marketplace";
import type {
  BillView,
  CreateContributionIntentResult,
  MoneyOperationCode,
} from "@/contracts/money";
import { callOperation } from "@/features/presentation/call-operation";

/**
 * The browser's side of the Phase 3A Wanted-creation boundary
 * (docs/integration/marketplace-http-contract.md).
 *
 * Each function is a thin, typed call onto one published route. It decides
 * nothing: eligibility, the taxonomy hierarchy, the duplicate-check token and
 * whether a payment may be prepared are all server decisions enforced again by
 * RLS. Nothing here retries, because issuing a duplicate-check token is
 * deliberately not idempotent and a silent retry would mint a second one.
 *
 * Commissioner identity and institution are never sent. The server derives
 * them from the session and discards caller-supplied identity fields, so
 * including them would be a lie about where authority lives.
 */

const DRAFTS = "/api/marketplace/wanted/drafts";

/** The route id is authoritative, so a caller-supplied id must not shape the path. */
function draftPath(draftId: string, suffix = ""): string {
  return `${DRAFTS}/${encodeURIComponent(draftId)}${suffix}`;
}

/**
 * Persists the draft: a create when the workspace holds no draft yet, an
 * update at that draft's own address once it does.
 */
export function saveWantedDraft(
  input: WantedDraftInput,
  draftId: string | null,
): Promise<CreateWantedDraftResult> {
  return draftId === null
    ? callOperation<WantedDraftView, MarketplaceOperationCode>(
        DRAFTS,
        input,
        "MARKETPLACE_UNAVAILABLE",
      )
    : callOperation<WantedDraftView, MarketplaceOperationCode>(
        draftPath(draftId),
        input,
        "MARKETPLACE_UNAVAILABLE",
        "PUT",
      );
}

/**
 * Runs the server's duplicate check and returns the one-use token the
 * publication request must carry. The token is opaque here: it is minted and
 * verified by the server, and the browser only carries it back.
 */
export function checkWantedDuplicates(draftId: string): Promise<SuggestWantedDuplicatesResult> {
  return callOperation<
    { token: string; expiresAt: string; suggestions: WantedDuplicateSuggestion[] },
    MarketplaceOperationCode
  >("/api/marketplace/wanted/duplicate-suggestions", { draftId }, "MARKETPLACE_UNAVAILABLE");
}

/**
 * Asks the server to prepare publication.
 *
 * Money is integer sen (context/architecture.md); nothing here computes on it.
 * A success means the draft is awaiting payment, never that a payment was
 * taken or that a Wanted opened — only a verified provider callback does that.
 */
export function requestWantedPublication(
  draftId: string,
  duplicateCheckToken: string,
  initialContributionSen: number,
): Promise<PrepareWantedPublicationResult> {
  return callOperation<
    { draftId: string; state: "awaiting_payment"; paymentRequired: true },
    MarketplaceOperationCode
  >(
    draftPath(draftId, "/publication"),
    { duplicateCheckToken, initialContributionSen },
    "MARKETPLACE_UNAVAILABLE",
  );
}

/**
 * Initiates the draft's contribution bill via ToyyibPay.
 *
 * Money is integer sen (RM1–RM50 = 100–5,000 sen).
 * Returns a BillView with paymentUrl on success, or a refusal code like
 * PAYMENT_DISABLED or AMOUNT_OUT_OF_RANGE.
 */
export function createDraftContributionBill(
  draftId: string,
  duplicateCheckToken: string,
  amountSen: number,
): Promise<CreateContributionIntentResult> {
  return callOperation<BillView, MoneyOperationCode>(
    draftPath(draftId, "/contribution"),
    { duplicateCheckToken, amountSen },
    "MONEY_UNAVAILABLE",
  );
}

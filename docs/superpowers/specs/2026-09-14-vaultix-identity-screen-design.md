# VAULTIX Identity Screen Design Specification

**Date:** 2026-09-14
**Status:** Design preparation. No contract consumed, no screen connected, no `FixtureNotice` removed.
**Branch:** `codex/integration-identity`
**Covers:** `/profile`, `/profile/institution-verification`, `/verify-email`, `/console`

## 1. Purpose and standing

This specifies the presentation of the four identity screens so that integration, when the read
contract from `docs/superpowers/specs/2026-09-14-vaultix-identity-read-contract.md` lands, is a
wiring exercise rather than a design exercise.

It is written against what exists today: the committed components, the provisional token layer, and
the published `VerificationOperationCode` union. It consumes no uncommitted Codex file, invents no
contract, and hardcodes no institution identifier or email domain.

Every state named here must be reachable and testable. A state that cannot be provoked in a test is
a state that will be wrong in production.

### 1.1 What this document does not decide

- Branded visual treatment. `context/ui-context.md` is explicit that with no design handoff, work is
  restricted to accessible structure. Nothing here specifies a colour value, an illustration, a
  pixel-art asset, or a display face.
- Backend behaviour, route shapes, or permission rules. Those are Codex's, and §5 of the read
  contract already records the two items awaiting its decision.
- Whether a screen is connected. All four keep their `FixtureNotice` until their operation exists
  and is integrated in the same tested slice.

## 2. Shared state vocabulary

Ten states are required of every screen. `UiStatus` offers six kinds. The mapping is deliberate and
must be applied consistently, because a user who learns what "Restricted" looks like on one screen
must not meet a different presentation of the same idea on the next.

| Required state | Presentation | `UiStatus` kind | Announced as |
| --- | --- | --- | --- |
| Loading | `UiStatus` | `loading` | `aria-live="polite"`, `aria-busy` |
| Empty | `UiStatus` | `empty` | not announced |
| Success | screen content, no `UiStatus` | — | see §6.3 |
| Validation error | `ErrorSummary` + `FormField error` | **none** | `role="alert"` on the summary |
| Provider error | `UiStatus` | `error` | `role="alert"` |
| Offline | `UiStatus` | `offline` | `role="status"` |
| Restricted | `UiStatus` | `restricted` | `role="alert"` |
| Expired | `UiStatus` | `expired` | `role="status"` |
| Recent-auth-required | `UiStatus` + re-auth action | `restricted` | `role="alert"` |
| Unauthorised | `UiStatus` | `restricted` | `role="alert"` |

Two rules follow from that table and are easy to get wrong:

1. **A validation error is never a `UiStatus`.** It belongs on the field and in the summary. Routing
   it through `UiStatus` detaches the message from the control that failed, which
   `context/ui-context.md` forbids.
2. **Restricted, recent-auth-required, and unauthorised share one kind and differ in copy and
   action.** The kind is the visual and semantic category; the words carry the distinction. Do not
   invent a seventh kind for them.

### 2.1 Operation code to state

Every published code has exactly one presentation. `IDENTITY_MESSAGE` already holds fallback copy;
the operation's own `message` wins when present, because the wording a user reads about their
account should come from the decision that produced it.

| Code | State | Action offered | Focus moves to |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | Validation error | — | `ErrorSummary` |
| `UNSUPPORTED_EVIDENCE_TYPE` | Validation error, on the file field | — | `ErrorSummary` |
| `INVALID_CREDENTIALS` | Validation error, form-level | — | `ErrorSummary` |
| `EMAIL_NOT_VERIFIED` | Restricted | Go to `/verify-email` | status container |
| `AUTH_REQUIRED` | Unauthorised | Sign in | status container |
| `NOT_AUTHORIZED` | Unauthorised | — | status container |
| `RECENT_AUTH_REQUIRED` | Recent-auth-required | Confirm it is you | status container |
| `AUTH_RATE_LIMITED` | Provider error | Retry, disabled until the stated wait passes | status container |
| `AUTH_UNAVAILABLE` | Offline | Try again | status container |
| `EVIDENCE_UPLOAD_UNAVAILABLE` | Offline | Try again | status container |
| `REGISTRATION_FAILED` | Provider error | Try again | status container |
| `REQUEST_NOT_FOUND` | Expired | Refresh the queue | status container |
| `VERIFICATION_CONFLICT` | Expired | Refresh the queue | status container |
| `DOMAIN_NOT_APPROVED` | **Not an error** — see below | Continue to evidence | next step heading |

`DOMAIN_NOT_APPROVED` is the single most likely presentation mistake in this phase. It is not a
failure the user caused and not a fault to apologise for: it is the expected routing signal from the
automatic path to manual review, and today it is the *only* outcome the operation can return,
because the approved-domain list is deliberately empty pending the open UiTM question. Present it as
a transition — "Your email domain is not on the approved list, so a Sheriff will review your
evidence" — and move the user forward. Presenting it as `error` would tell most of the first
cohort they did something wrong when they did not.

`callOperation` already collapses transport failure and malformed payloads into the caller's
`unavailableCode`, so the Offline row covers a dropped connection without a separate code path.

## 3. State matrices

Each matrix gives the states that screen must render, what triggers each, and what the user sees.
"Trigger" is what a test must be able to produce.

### 3.1 `/profile`

Consumes `AccountViewModel` (read contract §4.1) through the server loader. First paint is server
rendered; there is no client fetch on this screen.

| State | Trigger | Presentation |
| --- | --- | --- |
| Loading | Server render in flight | route-level `loading.tsx`; `UiStatus loading`, "Loading your account" |
| Success | Loader returns a view model | `VerificationStatus` with both badges and the capability list |
| Empty | Not reachable | An account always has two trust states. Do not build an empty state here. |
| Validation error | Not reachable | The screen submits nothing. |
| Provider error | Loader throws | `UiStatus error`, "Your account could not be loaded", retry link to `/profile` |
| Offline | Loader cannot reach Supabase | `UiStatus offline`, same retry |
| Restricted | `trust.restricted === true` | `UiStatus restricted` above the capability list, stating the account is restricted and what remains permitted |
| Expired | Session expired mid-render | Treated as Unauthorised — there is no half-signed-in state |
| Recent-auth-required | Not reachable | The screen performs no sensitive operation |
| Unauthorised | Loader returns `null` | `UiStatus restricted`, "Sign in to see your account", link to `/sign-in` |

Four points of substance:

- **Capabilities are rendered, never computed.** `VerificationStatus` already takes an
  `AccountCapabilities` object and `account-capabilities.ts` documents the prohibition. The screen
  must pass `viewModel.capabilities` straight through. A `trust.institution === "verified"` test
  anywhere in the frontend is a defect, because it forks the access policy.
- **Restriction is a third axis.** A restricted account can be email-verified and
  institution-verified and still be unable to transact. The existing
  `RESTRICTION_MESSAGE` map in `verification-status.tsx` is keyed only on institution state and has
  no restricted case — it needs a distinct branch so a restricted user is not told to "verify your
  institution" when that is already done and is not the problem.
- **Unauthorised is a render, not a redirect.** Bouncing to `/sign-in` loses the reason. Render the
  refusal with a link; let the user decide.
- **The star is institution-only.** `TrustBadge` already enforces this and carries the explanatory
  note. Do not add an emblem to the email badge.

### 3.2 `/profile/institution-verification`

The richest screen. Consumes §4.1 for current state, §4.2 for institutions, and calls three
operations. Step flow is in §7.

| State | Trigger | Presentation |
| --- | --- | --- |
| Loading (initial) | Server render | `UiStatus loading`, "Loading your verification status" |
| Loading (submitting) | Any of the three calls in flight | `UiStatus loading` with the step named; submit disabled |
| Success (automatic) | `verify-domain` returns `verified` | `UiStatus` success content, star badge, link to `/profile` |
| Success (manual) | `verification-requests` returns `pending` | Pending panel with the submitted date and evidence deletion date |
| Empty | §4.2 returns no institutions | `UiStatus empty`, "No institutions are available for verification yet"; evidence form hidden |
| Validation error | No file, no declaration, no institution, or `UNSUPPORTED_EVIDENCE_TYPE` | `ErrorSummary` + field errors |
| Provider error | `REGISTRATION_FAILED`-class failure, or signed `PUT` rejects | `UiStatus error`, retry preserving the chosen institution |
| Offline | `AUTH_UNAVAILABLE`, `EVIDENCE_UPLOAD_UNAVAILABLE`, transport failure | `UiStatus offline`, retry |
| Restricted | `EMAIL_NOT_VERIFIED` | `UiStatus restricted`, link to `/verify-email`; form hidden |
| Expired | Signed upload token rejected as stale | `UiStatus expired`, "Start the upload again"; re-request a URL |
| Recent-auth-required | `RECENT_AUTH_REQUIRED` | `UiStatus restricted` with re-auth action |
| Unauthorised | `AUTH_REQUIRED`, or `NOT_AUTHORIZED` on a path mismatch | `UiStatus restricted`, sign-in link |
| Already pending | `trust.institution === "pending"` | Pending panel; request form hidden, per current `canRequest` logic |
| Already verified | `trust.institution === "verified"` | Confirmation; no form |
| Rejected | `trust.institution === "rejected"` | Reason from the view model, then the form again |

Notes:

- **The institution select must never fall back to a hardcoded identifier.** If §4.2 returns an
  empty list, the evidence path is genuinely unavailable and must say so. An invented UUID would
  submit a request against the wrong institution, which is a data-integrity fault, not a UI
  shortcut.
- **`VERIFICATION_CONFLICT` on submit means a request already exists.** Re-read §4.1 and render the
  pending panel rather than repeating the form.
- **Evidence type copy stays narrower than the claim allowlist.** PDF, JPEG, PNG only. The component
  comment already records why: offering a type the operation rejects wastes the user's attempt.

### 3.3 `/verify-email`

Status arrives in the query string from the emailed link. Read contract §4.6 asks Codex to route the
callback here.

| State | Trigger | Presentation |
| --- | --- | --- |
| Loading | Resend in flight | `UiStatus loading`, "Sending a new link"; button disabled |
| Success (verified) | `?status=verified` | Email badge, and the explicit note that institution verification is separate and still required to transact |
| Success (resent) | Resend returns `accepted` | `UiStatus` confirmation, "If that address needs a link, one is on its way" |
| Empty | Not reachable | — |
| Validation error | Not reachable | Nothing is typed on this screen |
| Provider error | `AUTH_UNAVAILABLE` on resend | `UiStatus error`, retry |
| Offline | Transport failure | `UiStatus offline`, retry |
| Restricted | Not reachable | — |
| Expired | `?status=expired` | `UiStatus expired` + resend |
| Recent-auth-required | Not reachable | — |
| Unauthorised | `?status=invalid` | `UiStatus error`, "That link could not be used"; direct to sign-in |
| **Unknown value** | `?status=` anything else, absent, or repeated | **Falls back to `pending`** |

The unknown-value rule is a security property, not tidiness. `readStatus` already defaults to
`pending` and handles the array form of a repeated parameter. It must never default to `verified`:
the query string is attacker-supplied, and a screen that says "Email Verified" because someone typed
`?status=verified` teaches users to trust a claim the server never made. The resend confirmation
follows the `recovery` precedent and does not disclose whether the address exists.

### 3.4 `/console`

Consumes §4.1 for role and §4.3 for the queue. Interaction design is in §8.

| State | Trigger | Presentation |
| --- | --- | --- |
| Loading | Queue read in flight | `UiStatus loading`, "Loading the review queue" |
| Success | Queue returns rows | Queue list; detail panel on selection |
| Empty | Queue returns `[]` for an authorised reviewer | `UiStatus empty`, "No requests are waiting for review" |
| Validation error | Decision submitted with no reason code | `ErrorSummary` + field error on the reason control |
| Provider error | Review call fails | `UiStatus error`; the row stays pending and selectable |
| Offline | Transport failure | `UiStatus offline`; retry without losing the selection |
| Restricted | `console.hasAccess === false` | Existing `ConsoleLanding` refusal |
| Expired | `REQUEST_NOT_FOUND`, or evidence past `evidenceDeleteAfter` | `UiStatus expired`, refresh the queue |
| Recent-auth-required | `RECENT_AUTH_REQUIRED` | `UiStatus restricted` with re-auth, decision preserved but not submitted |
| Unauthorised | `NOT_AUTHORIZED` | `UiStatus restricted`; the row is removed on refresh |
| Already decided | `VERIFICATION_CONFLICT` | `UiStatus expired`, "Another Sheriff already decided this request"; refresh |

The existing `ConsoleLanding` refusal copy is worth keeping verbatim — "Access is checked on the
server and in the database for every console operation. A hidden link is never what keeps a queue
private." It states the invariant to the one audience most likely to probe it.

## 4. Responsive behaviour from 360 px

The shell already survives 360 px without JavaScript: `AppShell` wraps its navigation rather than
collapsing it into a disclosure, and its comment records that a client disclosure arrives only when
the navigation outgrows one row. Adding the Sheriff Console entry makes six items, so that threshold
is close — measure before adding a seventh.

Breakpoint policy: two, expressed in tokens, mobile-first. No fixed pixel widths on content, no
`min-width` exceeding 360 px on any element.

| Width | Layout |
| --- | --- |
| 360–599 | Single column. Full-width controls. Badges stack. |
| 600–899 | Single column, constrained measure. Badges sit inline. |
| 900+ | Console gains its two-pane layout; everything else keeps the constrained measure. |

Per screen:

- **`/profile`** — the capability list is the one at risk. It is a name/state pair per row, which at
  360 px must stack the state under the name rather than truncate either. It must not become a
  table.
- **`/profile/institution-verification`** — the file input is the hazard: native file inputs overflow
  their container at narrow widths in several engines. Constrain it to `max-width: 100%` and let the
  chosen filename wrap, with `overflow-wrap: anywhere`, since filenames are user-supplied and
  arbitrarily long. The step indicator (§7) becomes a compact "Step 2 of 4" line below 600 px
  instead of a horizontal track.
- **`/verify-email`** — already single-column. No work.
- **`/console`** — the real responsive problem. `context/ui-context.md` requires the console to be
  desktop-efficient while urgent triage stays functional at 360 px.

```
  >= 900px                             360-599px
  +----------------+----------------+  +-------------------------+
  | Queue          | Detail         |  | Queue (cards)           |
  | [row] selected | applicant      |  | [card] -> navigates to  |
  | [row]          | institution    |  | [card]    detail view   |
  | [row]          | evidence       |  | [card]                  |
  |                | decide         |  +-------------------------+
  +----------------+----------------+  Detail replaces the list;
  Selection keeps both panes visible.  a Back control returns.
```

Below 900 px the two panes become two views, not two stacked panels — stacking would push the
decision controls an unpredictable distance down the page. The queue rows become cards, never a
horizontally scrolling table: `context/ui-context.md` requires a usable narrow-screen alternative
rather than clipping essential actions.

The evidence viewer (§8.3) is full-screen below 900 px.

## 5. Keyboard and focus flows

Every flow must be completable with a keyboard alone. The existing components establish most of the
pattern; these are the rules that keep it consistent.

### 5.1 Established behaviour to preserve

- Skip link first in tab order, revealed on focus, targeting `#main-content`.
- `main` carries `tabIndex={-1}` so it can receive programmatic focus.
- `ErrorSummary` is `tabIndex={-1}` and focused on validation failure; its links call `focusField`,
  which moves DOM focus into the field rather than merely scrolling to it. That distinction is
  already documented in the component and must not regress.
- Visible focus everywhere, via the `--focus-ring` tokens. No `outline: none` without an equally
  visible replacement.

### 5.2 Rules this specification adds

1. **One focus move per submission.** If field errors exist, focus the `ErrorSummary` and nothing
   else. If the operation refused without field errors, focus the status container. Never both — two
   moves in one tick means the first is inaudible.
2. **Status containers that carry an action are focusable.** A `UiStatus` with an `action` needs
   `tabIndex={-1}` on its root so focus can land there; the action is then the next tab stop. A
   `UiStatus` with no action is announced by its role and needs no focus move.
3. **Focus after navigation.** `router.push` does not move focus. After a client-side navigation
   that completes a flow, focus `#main-content` so the next Tab starts at the top of the new screen.
4. **Never trap focus outside a dialog.** The only focus trap in these screens is the evidence
   viewer.
5. **Disabled submit keeps its place.** A submitting button stays focused and becomes
   `aria-disabled`, rather than `disabled` — a `disabled` control drops focus to `body`, which
   silently strands a screen-reader user mid-flow. This is a change from the current forms, which
   use `disabled`, and should be applied when each form is connected.

### 5.3 Per-screen tab order

```
/profile
  skip -> nav(6) -> [restricted action, if present] -> capability list -> footer

/profile/institution-verification
  skip -> nav -> [error summary] -> [status action] -> check-domain button
       -> institution select -> file input -> declaration checkbox -> submit -> footer

/verify-email
  skip -> nav -> [status action] -> resend button -> [sign-in, verify-institution] -> footer

/console  (>= 900px)
  skip -> nav -> queue row 1..n -> detail heading -> view-evidence
       -> reason select -> approve -> reject -> footer
```

Queue rows are buttons, not links: selecting a row changes the adjacent panel rather than navigating,
so it is not a destination. Below 900 px selection *is* a navigation, and the row becomes a link.

## 6. Screen-reader labels and live regions

### 6.1 What `UiStatus` already guarantees

Every kind renders a visible text label, so no state is conveyed by colour alone. `error` and
`restricted` announce as `role="alert"`; `expired` and `offline` as `role="status"`; `loading` sets
`aria-live="polite"` and `aria-busy`. The rationale is in the component: failure and refusal
interrupt because the user cannot proceed, lifecycle and connectivity wait their turn.

### 6.2 The double-announcement hazard

`ErrorSummary` is `role="alert"`. Every `UiStatus` of kind `error` or `restricted` is also
`role="alert"`. Rendering both in one update queues two interrupting announcements and the second
usually clips the first.

`SignInForm` already guards this by rendering its general status only when `errors.length === 0`.
**That guard is a requirement, not an incidental detail, and every connected form must carry it.**
The rule: *at most one `role="alert"` may enter the accessibility tree per user action.*

A related trap is on the test side. Next injects its own route announcer with `role="alert"`, so an
unfiltered `getByRole("alert")` matches two elements and fails Playwright's strict mode. The tracker
already records this. Scope alert queries to the form or status container.

### 6.3 Success announcements

Success is the gap in the current design. Rendering new content announces nothing, so a screen-reader
user who submits the verification form hears silence and cannot tell whether it worked.

Each successful operation must announce once, through a polite live region that is present in the DOM
*before* the update — a region inserted at the same time as its message is unreliably announced.
Recommended: a single always-present `aria-live="polite"` region per screen, empty until needed.

| Screen | Success announcement |
| --- | --- |
| `/profile` | none — nothing changed on this screen |
| institution verification | "Verification request submitted. A Sheriff will review it." |
| `/verify-email` | "A new verification link has been sent." |
| `/console` | "Request approved." / "Request rejected." |

### 6.4 Labels

- `TrustBadge` text already carries the state in words; the star is `aria-hidden` with the label
  beside it, which is correct — it must never become the only carrier of meaning.
- The capability list uses `aria-label="Account capabilities"`; each row states "Allowed" or "Not
  allowed" in text.
- The institution select needs a real `<label>`, not a placeholder option.
- The queue needs a count in its accessible name — "Verification requests, 4 waiting" — so a
  reviewer knows the size without traversing it.
- The file input's accepted types belong in a hint linked by `aria-describedby`, which `FormField`
  already wires.

## 7. Institution-verification step flow

Four steps, two paths. The automatic path is one call; the manual path is three, and the middle one
uploads to storage rather than to the application.

```
  Step 1  Status
          |
          +-- verified ----> confirmation, no form
          +-- pending -----> pending panel, no form
          +-- unverified/rejected
                 |
  Step 2  Automatic check ....... POST /api/identity/verify-domain  {}
                 |
                 +-- verified -------------> done
                 +-- DOMAIN_NOT_APPROVED --> continue (expected today)
                 |
  Step 3  Evidence
          choose institution (from §4.2)
          choose file (PDF/JPEG/PNG)
          confirm declaration
                 |
          3a  POST .../verification-evidence/upload-url   -> signed URL
          3b  PUT  <signed URL>                           -> storage
          3c  POST .../verification-requests              -> pending
                 |
  Step 4  Pending
          submitted date, evidence deletion date, what happens next
```

### 7.1 Partial failure between 3a, 3b and 3c

This is the part most likely to be built wrong, because the happy path hides it. Each sub-step can
fail independently and the user must never be left unable to retry.

| Fails at | What exists | What the user sees | Retry |
| --- | --- | --- | --- |
| 3a | nothing | Offline or provider error | Re-submit; a new URL is minted |
| 3b | an unused signed URL | Provider error, "Your document was not uploaded" | Re-submit from 3a; do not reuse a possibly-stale token |
| 3c | **an uploaded, unattached object** | Provider error, "Your document was uploaded but the request was not created" | Retry 3c with the same path before falling back to 3a |

The 3c failure is the interesting one: evidence is sitting in private storage attached to no request.
The migrations already anticipate it — `identity_evidence_delete_own_unattached` lets the owner clean
up — so the UI should retry 3c with the path it already holds rather than uploading a second copy.
Two copies of someone's identity document is a privacy cost, not just waste.

Retrying must not silently create a second request: if 3c returns `VERIFICATION_CONFLICT`, a request
already exists and the screen moves to Step 4.

### 7.2 Progress and cancellation

- The upload is a single file of at most a few megabytes, so a determinate progress bar is
  unnecessary; `UiStatus loading` naming the step is enough.
- The step in flight must be named — "Preparing the upload", "Uploading your document", "Submitting
  your request" — because the three have different retry advice.
- Navigating away mid-upload is not blocked. An unattached object is recoverable; a blocked
  navigation is not something to inflict on someone who changed their mind about uploading their
  student card.

### 7.3 Privacy surface

The declaration and the existing privacy note must stay adjacent to the file input, and the note's
claims must remain true: stored privately, Sheriff-readable only, never on the Board, never attached
to a claim, never emailed, deleted 30 days after the decision. `evidenceDeleteAfter` from §4.1 is the
authoritative date and should be shown rather than the words "30 days" recomputed in the client.

## 8. Sheriff queue and evidence viewer

### 8.1 Queue

Rows come from §4.3 and are already scoped by RLS to the reviewer's institutions. Each row shows
applicant display name, institution, submitted date, and time remaining before evidence deletion.

- **No applicant email address in the console.** §4.3 deliberately omits it: it is not needed to
  judge a document, and every field shown is a field that can leak.
- **No object keys, ever.** Not in the row, not in a `data-` attribute, not in a title.
- Sort oldest-first; a verification request blocks someone from participating, so age is the
  relevant urgency.
- The deletion countdown is informational until it passes, at which point the row is expired and the
  decision controls are replaced by an explanation (§8.4).
- Empty is a first-class state: `UiStatus empty`, not a blank panel.

### 8.2 Decision

A decision is a recorded human moderation act. Three rules follow:

1. **No optimistic UI.** The row shows "Submitting", then the server's answer. Never paint the
   outcome before it is recorded — `context/architecture.md` requires a recorded human approval, and
   a UI that shows "Approved" before the write lands is claiming one that may not exist.
2. **A reason code is required for both outcomes.** Approval reasons matter as much as rejection
   reasons to the audit trail.
3. **Confirmation before submission**, with a consequence summary, per `context/ui-context.md`. For
   approval: this grants the star emblem and permits transacting, claiming and downloading. For
   rejection: this does not, and the applicant sees the reason.

`RECENT_AUTH_REQUIRED` must preserve the selected decision and reason across re-authentication —
losing a reviewer's reasoning because a fifteen-minute window lapsed invites shorter reasons.

### 8.3 Evidence viewer

The highest-risk interaction in Phase 2: a private identity document belonging to someone else,
opened by a reviewer.

- **Mint on demand.** The URL is requested when the reviewer opens the viewer, never when the queue
  renders. Rendering twenty rows must not mint twenty URLs to twenty identity documents.
- **Hold in component state only.** Never in `localStorage`, `sessionStorage`, IndexedDB, a URL, a
  query parameter, a form value, or a `data-` attribute. It survives exactly as long as the dialog.
- **Clear on close and on decision.** Drop the URL from state when the dialog closes; do not keep it
  for a possible re-open.
- **Render in-dialog rather than opening a tab.** A new tab puts the signed URL in the address bar,
  in history, and in anything syncing that history. If a fallback tab is ever needed, it carries
  `rel="noopener noreferrer"`.
- **Never in an error message or log.** A failed load says the document could not be opened. It does
  not echo the URL, the key, or the provider's response.
- **Show the expiry.** The reviewer sees how long the link is valid; on expiry the viewer re-requests
  rather than silently failing.
- **Text alternative.** `context/ui-context.md` requires a safe preview to offer a text alternative
  or a clear unsupported-preview message. A PDF that cannot render inline must say so and still let
  the reviewer decide.

Dialog mechanics: focus moves to the dialog on open and is trapped; `Escape` closes; focus returns to
the trigger row. `aria-modal="true"` with a labelled heading naming the applicant and institution.
Full-screen below 900 px.

### 8.4 Expired evidence

When `evidenceDeleteAfter` has passed, the document is gone by retention policy. The row stays
visible — it is still a pending request — but the viewer is replaced by an explanation and the
decision controls are disabled, because deciding without evidence is not a decision. The route
forward is an operational one, outside this screen.

## 9. Component reuse map

Nothing in this specification needs a new primitive. The four screens are assembled from what exists
plus three small additions.

| Need | Use | Change required |
| --- | --- | --- |
| Frame, skip link, nav, landmarks | `AppShell` | Pass `roleNav` from `console.hasAccess` |
| All ten non-success states | `UiStatus` | Add optional `tabIndex={-1}` for actionable statuses (§5.2) |
| Trust presentation | `TrustBadge` | None — states already match the contract union |
| Trust + capabilities block | `VerificationStatus` | Add a restricted branch to `RESTRICTION_MESSAGE` (§3.1) |
| Text and file inputs | `FormField` | None — already handles `accept`, hints, errors, `aria-describedby` |
| Validation summary | `ErrorSummary` | None |
| Console refusal | `ConsoleLanding` | Keep the refusal path; replace the planned-queue list with the real queue |
| Email outcomes | `EmailVerification` | Replace the stub resend handler with the §4.5 call |
| Verification form | `InstitutionVerification` | Add institution select and the three-call sequence |
| Operation calls | `callOperation` | Add `GET` support (frontend-owned, no contract change) |
| Code to copy | `IDENTITY_MESSAGE` | None — covers the full union |
| Hydration gating | `useHydrated` | None |

New, all presentation-only and Claude-owned:

1. **`InstitutionSelect`** — a labelled select over `InstitutionOption[]`, with the empty-list state
   from §3.2. No fallback identifier.
2. **`ReviewQueue` + `ReviewQueueItem`** — list and row, responsive per §4.
3. **`EvidenceViewer`** — the dialog in §8.3. The only component that ever holds a signed URL, which
   is why the rule lives in one place rather than being repeated at each call site.

Token discipline is unchanged: the 49 provisional custom properties in `globals.css` cover colour,
type, spacing, shape, elevation, focus and motion, and all 23 colour pairings are contrast-verified.
No component introduces a literal visual value. New components reuse existing class patterns rather
than inventing parallel ones.

Reduced motion is already handled at the token layer — `--motion-fast` and `--motion-base` collapse
to `1ms` under `prefers-reduced-motion: reduce`, so a component that animates through the tokens
honours the preference without its own media query. Components must therefore never write a literal
duration.

## 10. Appendix: Phase 3 Wanted Board — structural exploration

Documentation only. Not a commitment, not scheduled, and explicitly not a visual design: with no
handoff, `context/ai-workflow-rules.md` restricts this to accessible structure.

Recorded now only because the Board's filter-plus-results structure is the first place the identity
capability model becomes visible to a student, and getting that relationship wrong is expensive
later.

```
  360px                        900px+
  +----------------------+     +----------+--------------------------+
  | [Filters v]  collapsed|    | Filters  | 24 results  [sort v]     |
  +----------------------+     | (static) +--------------------------+
  | Wanted card          |     |          | card | card              |
  |  course . institution|     |          | card | card              |
  |  type . period       |     |          | card | card              |
  |  RM xx.xx  n Backers |     |          |                          |
  |  age . status        |     +----------+--------------------------+
  +----------------------+
```

Three structural points worth settling before that phase:

1. **Browsing is permitted on email verification alone.** The Board is reachable by an
   institution-unverified account. Every card therefore needs a state for "visible but not
   actionable", and the contribute control must explain *why* it is unavailable and link to
   verification — a disabled button with no explanation is the single most likely accessibility and
   comprehension failure on that screen.
2. **Money is display-only at the presentation edge.** Amounts arrive as integer sen and are
   formatted once, with tabular figures. No arithmetic in a component.
3. **Filters must work without JavaScript** where practical, as query parameters, keeping the Board
   server-rendered and linkable. This follows the `AppShell` precedent of not reaching for client
   interactivity until the structure demands it.

Card content follows `context/ui-context.md`: course, institution/campus, resource type, academic
period, gross bounty, Backer count, age, and safe status. No file preview.

## 11. Addendum: contract status at time of writing

Codex published `57b11b9` "feat: expose identity account reads" during the drafting of this
document. It implements read contract §4.1 and §4.2 only.

**No mismatch.** `AccountViewModel` and `InstitutionOption` arrived field-for-field as proposed, so
every state matrix above holds without revision. Two details the proposal did not fix, now settled
by the published code:

- `loadAccountViewModel()` returns `AccountViewModel | null`, with `null` meaning no session. That
  is the Unauthorised row of §3.1, exactly as specified.
- `loadSelectableInstitutions()` returns a discriminated union rather than the envelope:
  `{ status: "auth_required" } | { status: "email_not_verified" } | { status: "ready"; institutions }`.
  Map `auth_required` to Unauthorised and `email_not_verified` to Restricted per §2.1; `ready` with
  an empty array remains the Empty state of §3.2. The HTTP routes keep the `OperationResult`
  envelope through `AccountViewResult` and `InstitutionOptionsResult`.

Published: §4.1, §4.2. Still missing: §4.3 review queue, §4.4 reviewer evidence access, §4.5 resend,
§4.6 callback redirect.

Consequently Slice 1 (`/profile`) and Slice 2 (`/profile/institution-verification`) are unblocked —
Slice 2's three write operations have existed since `175bc41`, and §4.2 supplied the missing
`institutionId` source. Slices 3 and 4 remain blocked.

## 12. Open questions

Neither blocks the four slices; both should be settled before visual acceptance.

1. **Does `UiStatus` need a distinct "rate limited" presentation?** `AUTH_RATE_LIMITED` is mapped to
   provider error above, but it differs in that waiting resolves it. If the operation returns a
   retry-after value, a countdown would be more useful than a retry button that fails.
2. **Should the console's queue live under `/console` or `/console/verification`?** A single queue
   reads fine today, but claims, reports and appeals arrive in later phases and will need a route
   each. Deciding now avoids moving the first one.

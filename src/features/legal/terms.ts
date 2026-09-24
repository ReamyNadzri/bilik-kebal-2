import { CURRENT_POLICY_VERSION } from "@/contracts/marketplace";

/**
 * The Terms a member accepts when posting a Wanted.
 *
 * DRAFT pending legal review. Written in plain English from the accepted
 * product rules in `context/project-overview.md` and
 * `context/architecture.md`; it adds no obligation those files do not state.
 * The version is snapshotted on every published Wanted
 * (`policy_version_snapshot`), so a later revision never rewrites what an
 * earlier poster agreed to.
 */
export const TERMS_VERSION = CURRENT_POLICY_VERSION;
export const TERMS_STATUS = "Draft — pending legal review";

export interface TermsSection {
  readonly heading: string;
  readonly points: readonly string[];
}

export const POSTING_TERMS: readonly TermsSection[] = [
  {
    heading: "What you may ask for",
    points: [
      "Ask only for material a student is allowed to share: your own notes, summaries, worked answers and similar work.",
      "Do not ask for publisher textbooks, paid tutorial material, leaked or unreleased exam papers, or documents your institution restricts.",
      "Missing-item requests describe something you lost. Do not post other people's personal details, and arrange any handover in a safe, public place.",
      "Discussions must stay respectful and on topic. Sheriffs may hide replies that break these terms.",
    ],
  },
  {
    heading: "Bounties and money",
    points: [
      "A bounty is optional. Any request may be posted free; a free request has no payment, no fee and no payout.",
      "Every member may post 3 free requests in total. A reward code adds more; each code can be redeemed once per member.",
      "On a missing item or discussion with a bounty, you release it by naming the member who helped. A Sheriff approves the release before anyone is paid.",
      "Each contribution to a bounty is RM1 to RM50. The payment provider's own charge is added on top and does not go into the bounty.",
      "A bounty changes only after the payment provider confirms the payment directly to VAULTIX. A redirect back to the site is not a confirmation.",
      "A platform fee (currently 10%) is taken from the bounty when a claim or a bounty release is approved. The rate is fixed at publication and does not change afterwards.",
      "If a request with a bounty expires without an approved claim, every confirmed contribution is refunded in full.",
    ],
  },
  {
    heading: "Claims, review and access",
    points: [
      "Only a human Sheriff can approve a claim. Automated checks are evidence for the Sheriff, never a decision.",
      "One claim wins each request. The winning Hunter receives the bounty after the platform fee.",
      "Contributors to a bounty get access to the approved resource. On a free request, the person who posted it gets access.",
      "A resource becomes free for everyone 48 hours after approval only if the Hunter opted in and a Sheriff confirmed the sharing rights.",
      "A rejected claim may be appealed once within 7 days. A different Sheriff decides the appeal, and the request's expiry and refunds pause meanwhile.",
    ],
  },
  {
    heading: "Your account and your data",
    points: [
      "Posting, funding and claiming need institution verification. Email verification alone lets you browse.",
      "Your public profile shows your display name, picture, bio, joined date, verification badges and the requests you posted. It never shows your email, your verification evidence, your claims or what you funded.",
      "Files submitted as claims stay private and quarantined until a Sheriff decides.",
      "Accounts that break these terms may be restricted. Restrictions are recorded and can be appealed.",
    ],
  },
];

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FixtureNotice } from "@/components/fixture-notice";
import { WantedDraftWorkspace } from "@/components/wanted-draft-workspace";
import { WANTED } from "@/features/marketplace/fixtures";
import { loadWantedTaxonomy } from "@/features/marketplace/taxonomy-source";

export const metadata: Metadata = {
  title: "Creation workspace preview | VAULTIX",
};

/**
 * Rendered per request so the production guard below runs per request. Left
 * static, Next prerenders the refusal at build time and then serves that body
 * with a 200 status, which reads as "found" to anything checking the code.
 */
export const dynamic = "force-dynamic";

/**
 * Development-only harness for the creation workspace.
 *
 * `/wanted/new` gates the form on the account view model's `transact`
 * capability, which needs an institution-verified membership that cannot be
 * granted outside the database. Without this route the validation, review,
 * duplicate-suggestion and 360 px behaviours would be reachable only in jsdom,
 * and the browser tests the brief asks for could not exist.
 *
 * This bypasses no authority. The workspace holds none: it validates, previews
 * and links, and every real decision — who may create a draft, what a duplicate
 * check returns, whether a payment succeeded — belongs to operations that do
 * not exist yet and will be enforced server-side and by RLS when they do. The
 * gate on `/wanted/new` itself is untouched.
 *
 * In a production build it renders the not-found page instead of the
 * workspace, verified against a real `next start` server: the form, its
 * controls and the duplicate list are all absent. Next serves that body with a
 * 200 rather than a 404 here, and `redirect()` behaves the same way, so the
 * guarantee is the absent content rather than the status line. Anything that
 * needs to detect this route programmatically should test the body.
 */
export default function WantedDraftPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const taxonomy = loadWantedTaxonomy();

  if (taxonomy.status !== "ready") {
    notFound();
  }

  return (
    <>
      <FixtureNotice screen="This development preview of the creation workspace" />

      <h1>Post a Wanted</h1>

      <p className="lede">
        Development preview of the creation workspace, rendered without an account so the form can
        be reviewed in a browser. It creates nothing and is not reachable in a production build.
      </p>

      <WantedDraftWorkspace taxonomy={taxonomy.data} board={WANTED} />
    </>
  );
}

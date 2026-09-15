import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FixtureNotice } from "@/components/fixture-notice";
import { WantedDraftWorkspace } from "@/components/wanted-draft-workspace";
import { loadPreviewTaxonomy } from "@/features/marketplace/preview-taxonomy";

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
 * `/wanted/new` now reads the real institution-scoped taxonomy and persists
 * its draft through the published Phase 3A operations. Both need an
 * institution-verified session, which cannot be granted outside the database
 * and is not seeded for CI, so without this route the form, its validation,
 * its keyboard behaviour and its 360 px layout would be reachable only in
 * jsdom. Delete this route, and `preview-taxonomy.ts` with it, once a seeded
 * verified identity can drive `/wanted/new` in a browser.
 *
 * This bypasses no authority and fabricates no outcome. In preview mode the
 * workspace saves nothing, asks the server for nothing, issues no
 * duplicate-check token and offers no control that leads to payment; it says
 * so on the review sheet. The gate on `/wanted/new` itself is untouched, and
 * every real decision stays with the operations and with RLS.
 *
 * In a production build it renders the not-found page instead of the
 * workspace, verified against a real `next start` server: the form, its
 * controls and the review sheet are all absent. Next serves that body with a
 * 200 rather than a 404 here, and `redirect()` behaves the same way, so the
 * guarantee is the absent content rather than the status line. Anything that
 * needs to detect this route programmatically should test the body.
 */
export default function WantedDraftPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const taxonomy = loadPreviewTaxonomy();

  if (taxonomy.status !== "ready") {
    notFound();
  }

  return (
    <>
      <FixtureNotice screen="The campus, faculty, programme, course, session, resource and tag lists on this development preview" />

      <h1>Post a Wanted</h1>

      <p className="lede">
        Development preview of the creation workspace, rendered without an account so the form can
        be reviewed in a browser. It saves nothing, checks nothing and takes no payment, and it is
        not reachable in a production build.
      </p>

      <WantedDraftWorkspace taxonomy={taxonomy.data} mode="preview" />
    </>
  );
}

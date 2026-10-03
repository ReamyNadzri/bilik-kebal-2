"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  TERMS_OF_USE_EFFECTIVE_DATE,
  TERMS_OF_USE_VERSION,
  type AcceptTermsCode,
} from "@/contracts/legal";
import { OPEN_BEFORE_TERMS } from "@/features/legal/legal-links";
import { takeTermsAgreement } from "@/features/legal/pending-agreement";
import { callOperation } from "@/features/presentation/call-operation";
import { TERMS_CONSENT_ERROR, TermsConsent } from "./terms-consent";
import { UiStatus } from "./ui-status";

/**
 * Shows the acceptance screen in place of the page for a signed-in member who
 * has not accepted the current Terms of Use, on every page except the legal
 * documents and sign-out. A courtesy, not access control: posting still takes
 * its own agreement, and every operation is authorised on the server.
 */
export function TermsGate({
  required,
  children,
}: {
  readonly required: boolean;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  if (!required || OPEN_BEFORE_TERMS.includes(pathname)) return <>{children}</>;
  return <TermsAcceptance />;
}

type State =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "refused"; code: AcceptTermsCode; message: string };

type AcceptResult = Awaited<ReturnType<typeof sendAcceptance>>;

function sendAcceptance() {
  return callOperation<{ outcome: string }, AcceptTermsCode>(
    "/api/legal/terms-acceptance",
    { version: TERMS_OF_USE_VERSION, confirmedAdult: true },
    "TERMS_UNAVAILABLE",
  );
}

export function TermsAcceptance() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const started = useRef(false);

  function settle(result: AcceptResult) {
    if (result.ok) {
      router.refresh();
      return;
    }
    setState({ kind: "refused", code: result.code, message: result.message });
  }
  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  });

  // The box was ticked at sign-up in this tab: record it now the account exists.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (takeTermsAgreement()) void sendAcceptance().then((result) => settleRef.current(result));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed) {
      setMissing(true);
      return;
    }
    setState({ kind: "saving" });
    settle(await sendAcceptance());
  }

  const saving = state.kind === "saving";

  return (
    <section className="panel terms-acceptance" aria-labelledby="terms-acceptance-heading">
      <h1 id="terms-acceptance-heading">Before you continue</h1>
      <p>
        Read the VAULTIX Terms of Use and Privacy Notice (version {TERMS_OF_USE_VERSION}, effective{" "}
        {TERMS_OF_USE_EFFECTIVE_DATE}) and agree to them to keep using VAULTIX. They say who may
        join, how posting, money and claims work, what data is kept and for how long.
      </p>
      <ul className="terms-acceptance__links">
        <li>
          <Link href="/terms">Terms of Use</Link>
        </li>
        <li>
          <Link href="/privacy">Privacy Notice</Link>
        </li>
        <li>
          <Link href="/refunds">Refund Policy</Link>
        </li>
        <li lang="ms">
          <Link href="/privacy?lang=ms" hrefLang="ms">
            Baca dalam Bahasa Melayu
          </Link>
        </li>
      </ul>

      {state.kind === "refused" ? (
        <UiStatus
          kind={state.code === "TERMS_UNAVAILABLE" ? "offline" : "error"}
          heading="Your agreement was not saved"
          message={state.message}
          action={
            state.code === "TERMS_VERSION_STALE" ? (
              <button
                type="button"
                className="button button--quiet"
                onClick={() => router.refresh()}
              >
                Reload
              </button>
            ) : undefined
          }
        />
      ) : null}

      <form className="terms-acceptance__form" onSubmit={(event) => void submit(event)} noValidate>
        <TermsConsent
          id="terms-acceptance-consent"
          checked={agreed}
          onChange={(value) => {
            setAgreed(value);
            if (value) setMissing(false);
          }}
          error={missing ? TERMS_CONSENT_ERROR : undefined}
        />
        <div className="terms-acceptance__actions">
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Agree and continue"}
          </button>
          <Link className="button button--quiet" href="/sign-out">
            Sign out
          </Link>
        </div>
      </form>
    </section>
  );
}

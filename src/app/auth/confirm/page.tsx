import type { Metadata } from "next";
import { EmailLinkConfirm } from "@/components/email-link-confirm";

export const metadata: Metadata = {
  title: "Confirm | VAULTIX",
};

/** Reads per-request link parameters, so it is never cached. */
export const dynamic = "force-dynamic";

const TOKEN_HASH = /^[A-Za-z0-9_-]{1,512}$/;

function first(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.length > 0 ? candidate : null;
}

/**
 * Renders only. It never calls Supabase, so a link scanner's GET spends
 * nothing; POST /api/auth/confirm spends the token when the button is pressed.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawType = first(params.type);
  const type = rawType === "email" || rawType === "recovery" ? rawType : null;
  const rawToken = first(params.token_hash);
  const tokenHash = rawToken && TOKEN_HASH.test(rawToken) ? rawToken : null;

  return (
    <>
      <h1>{type === "recovery" ? "Reset your password" : "Confirm your email"}</h1>
      <EmailLinkConfirm
        tokenHash={tokenHash}
        type={type}
        next={first(params.next)}
        unavailable={first(params.status) === "unavailable"}
      />
    </>
  );
}

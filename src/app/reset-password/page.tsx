import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Set a new password | VAULTIX" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;

  return (
    <>
      <h1>Set a new password</h1>
      <ResetPasswordForm expired={status === "expired"} initialEmail={email} />
    </>
  );
}

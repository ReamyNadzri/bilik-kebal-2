import type { Metadata } from "next";
import { RecoverForm } from "@/components/recover-form";

export const metadata: Metadata = {
  title: "Recover your password | VAULTIX",
};

/** Connected to the identity operation; no fixture remains. */
export default function RecoverPage() {
  return (
    <>
      <h1>Recover your password</h1>
      <RecoverForm />
    </>
  );
}

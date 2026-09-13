import type { Metadata } from "next";
import { SignInForm } from "@/components/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in | VAULTIX",
};

/** Connected to the identity operation; no fixture remains. */
export default function SignInPage() {
  return (
    <>
      <h1>Sign in</h1>
      <SignInForm />
    </>
  );
}

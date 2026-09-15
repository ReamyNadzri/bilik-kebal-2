import type { Metadata } from "next";
import { SignUpForm } from "@/components/sign-up-form";

export const metadata: Metadata = {
  title: "Create account | VAULTIX",
};

/** Connected to the identity operation; no fixture remains. */
export default function SignUpPage() {
  return (
    <>
      <h1>Create an account</h1>
      <SignUpForm />
    </>
  );
}

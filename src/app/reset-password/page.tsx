import { permanentRedirect } from "next/navigation";

/**
 * Password resets happen on /recover with a Clerk code. Links from older
 * Supabase recovery emails still land here, so they are sent there.
 */
export default function ResetPasswordPage(): never {
  permanentRedirect("/recover");
}

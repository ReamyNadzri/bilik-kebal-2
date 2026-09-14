export function resolveAuthCallbackPath(input: {
  errorCode: string | null;
  next: string;
  otpType: string | null;
}): string {
  if (input.otpType === "recovery") {
    return input.errorCode ? "/sign-in?error=recovery_failed" : input.next;
  }
  const isEmailConfirmation = ["", "email", "invite", "magiclink", "email_change"].includes(
    input.otpType ?? "",
  );
  if (!isEmailConfirmation) {
    return input.errorCode ? "/verify-email?status=invalid" : input.next;
  }
  if (!input.errorCode) return "/verify-email?status=verified";
  return ["otp_expired", "flow_state_expired"].includes(input.errorCode)
    ? "/verify-email?status=expired"
    : "/verify-email?status=invalid";
}

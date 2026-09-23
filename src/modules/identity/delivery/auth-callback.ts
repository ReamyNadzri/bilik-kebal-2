export function resolveAuthCallbackPath(input: {
  errorCode: string | null;
  flow?: string | null;
  next: string;
  otpType: string | null;
}): string {
  if (input.otpType === "recovery" || input.flow === "recovery") {
    return input.errorCode ? "/reset-password?status=expired" : "/reset-password";
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

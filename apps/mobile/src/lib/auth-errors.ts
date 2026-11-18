export function authErrorMessage(error: unknown): string {
  const value = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
  };
  const message = value?.message || "";
  if (/sending (confirmation|recovery|reset).*email|smtp/i.test(message))
    return "We couldn't send your email. Please try again shortly. If you were creating an account, it may not have been created yet.";
  if (value?.code === "email_not_confirmed")
    return "Confirm your email before signing in. Open the confirmation link on this phone, or resend it below.";
  if (value?.code === "invalid_credentials")
    return "The email or password is incorrect. If signup previously failed, create your account first. You can also reset your password.";
  if (value?.status === 429 || /rate.limit|too many requests/i.test(message))
    return "Too many attempts. Please wait a few minutes before trying again.";
  if (
    value?.name === "AbortError" ||
    /network request failed|failed to fetch|aborted|timed? ?out/i.test(message)
  )
    return "Couldn't connect to Tracksy. Check your internet connection and try again.";
  return message || "Something went wrong. Please try again.";
}

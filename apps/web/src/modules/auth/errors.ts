/** Map provider errors to safe, user-facing messages. Never surface raw SQL/auth internals. */
export function mapAuthError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const message =
    "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (message.includes("invalid login credentials")) {
    return "Unable to sign in with those credentials.";
  }
  if (message.includes("email not confirmed")) {
    return "Confirm your email before signing in.";
  }
  if (message.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (message.includes("password should be")) {
    return "Password does not meet requirements.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please try again later.";
  }
  if (message.includes("same password")) {
    return "Choose a different password.";
  }

  return fallback;
}

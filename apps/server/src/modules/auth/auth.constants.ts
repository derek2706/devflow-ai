export const AUTH_MESSAGES = {
  USER_ALREADY_EXISTS: "User already exists",
  USER_REGISTERED: "User registered successfully",
  LOGIN_SUCCESS: "Login successful",
  INVALID_CREDENTIALS: "Invalid credentials",
  AUTHENTICATION_REQUIRED: "Authentication required",
  SESSION_EXPIRED: "Session expired; please sign in again",
  LOGOUT_SUCCESS: "Logged out successfully",
  FORGOT_PASSWORD:
    "If an account exists for that email, password reset instructions will be sent",
  PASSWORD_RESET: "Password reset successfully; please sign in",
  INVALID_RESET: "This password reset link is invalid or expired",
  ACCOUNT_NOT_VERIFIED: "Account not verified",
} as const;
export const AUTH_CONSTANTS = {
  SALT_ROUNDS: 10,
  ACCESS_TOKEN_EXPIRY: "15m",
  REFRESH_TOKEN_EXPIRY: "7d",
  PASSWORD_RESET_LIFETIME_MS: 30 * 60 * 1000,
};

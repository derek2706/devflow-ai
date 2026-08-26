export const AUTH_MESSAGES = {
  USER_ALREADY_EXISTS: "User already exists",

  USER_REGISTERED: "User registered successfully",

  INVALID_CREDENTIALS: "Invalid email or password",

  ACCOUNT_NOT_VERIFIED: "Account not verified",
} as const;

export const AUTH_CONSTANTS = {
  SALT_ROUNDS: 10,

  ACCESS_TOKEN_EXPIRY: "15m",

  REFRESH_TOKEN_EXPIRY: "30d",
};

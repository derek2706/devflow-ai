import { getEnv } from "./env";

// CORS and the browser-write guard must agree on every trusted frontend.
export function isAllowedOrigin(origin: string) {
  const { WEB_URL, CORS_ORIGINS } = getEnv();
  return origin === new URL(WEB_URL).origin || CORS_ORIGINS.includes(origin);
}

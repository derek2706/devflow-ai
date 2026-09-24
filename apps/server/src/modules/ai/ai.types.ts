export type AiProvider = "groq";
export type AiFallbackReason =
  | "quota"
  | "unavailable"
  | "timeout"
  | "invalid_response";

export interface AiStatus {
  mode: "local" | "provider";
  provider?: AiProvider;
  model?: string;
}

export interface AiGeneration<T> extends AiStatus {
  // On fallback, provider/model identify the attempted external provider.
  fallbackReason?: AiFallbackReason;
  contextLimited?: boolean;
  result: T;
}

export function getApiInternalOrigin(value?: string): string;
export function developmentApiRewrites(
  environment?: Record<string, string | undefined>,
): {
  source: string;
  destination: string;
}[];

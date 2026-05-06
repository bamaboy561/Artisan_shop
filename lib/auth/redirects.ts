export function getSafeRedirectPath(
  candidate: string | null | undefined,
  fallback: string,
) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}

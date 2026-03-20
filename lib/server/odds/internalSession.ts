export const INTERNAL_SESSION_COOKIE = "empire_internal_session";
export const INTERNAL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export function readCookieValue(cookieHeader: string | null, cookieName: string): string {
  if (!cookieHeader) return "";
  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (key !== cookieName) continue;
    const value = trimmed.slice(separator + 1).trim();
    if (!value) return "";
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return "";
}

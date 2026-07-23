/**
 * JWT lifetimes — override via env without code change.
 *
 * JWT_ACCESS_TTL_SECONDS  — access token (Bearer). Default 8 hours.
 * JWT_REFRESH_TTL_SECONDS — httpOnly refresh cookie. Default 7 days.
 */

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const env = (key: string): string | undefined =>
  process.env[key] ?? (typeof Bun !== "undefined" ? Bun.env[key] : undefined);

/** Access token lifetime in seconds (default 8h). */
export const ACCESS_TOKEN_TTL_SEC = parsePositiveInt(
  env("JWT_ACCESS_TTL_SECONDS"),
  8 * 60 * 60
);

/** Refresh token / cookie lifetime in seconds (default 7d). */
export const REFRESH_TOKEN_TTL_SEC = parsePositiveInt(
  env("JWT_REFRESH_TTL_SECONDS"),
  7 * 24 * 60 * 60
);

export function accessTokenExpUnix(): number {
  return Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SEC;
}

export function refreshTokenExpUnix(): number {
  return Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SEC;
}

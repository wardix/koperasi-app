/** Canonical auth API prefix (issue #208). */
export const AUTH_API_PREFIX = "/api/v1/auth";

export const PUBLIC_AUTH_PATHS = [
  `${AUTH_API_PREFIX}/login`,
  `${AUTH_API_PREFIX}/logout`,
  `${AUTH_API_PREFIX}/refresh`,
  `${AUTH_API_PREFIX}/google`,
  `/api/v1/member-auth/login`,
  `/api/v1/member-auth/google`,
  `/api/v1/member-auth/logout`,
  `/api/v1/member-auth/refresh`,
  `/api/v1/cron/due-dates`,
  // Public branding for login shell (no secrets)
  `/api/v1/settings/branding`,
] as const;

/** Legacy paths without /auth segment — forwarded with Deprecation header. */
export const LEGACY_AUTH_ALIASES = [
  { method: "POST" as const, legacy: "/api/v1/login", canonical: `${AUTH_API_PREFIX}/login` },
  { method: "POST" as const, legacy: "/api/v1/logout", canonical: `${AUTH_API_PREFIX}/logout` },
  { method: "POST" as const, legacy: "/api/v1/refresh", canonical: `${AUTH_API_PREFIX}/refresh` },
  { method: "POST" as const, legacy: "/api/v1/google", canonical: `${AUTH_API_PREFIX}/google` },
  { method: "GET" as const, legacy: "/api/v1/verify", canonical: `${AUTH_API_PREFIX}/verify` },
];

export function isPublicAuthPath(path: string): boolean {
  return (
    (PUBLIC_AUTH_PATHS as readonly string[]).includes(path) ||
    LEGACY_AUTH_ALIASES.some((alias) => alias.legacy === path)
  );
}
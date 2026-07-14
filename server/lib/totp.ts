import { verifySync, generateSync, generateURI, generateSecret } from "otplib";
import crypto from "node:crypto";

/** Default TOTP issuer name displayed in authenticator apps. */
const ISSUER = "KoperasiApp";

/** Number of recovery codes to generate by default. */
const DEFAULT_RECOVERY_CODE_COUNT = 8;

/** Length of each recovery code (4 bytes → 8 hex characters). */
const RECOVERY_CODE_BYTES = 4;

/** TOTP configuration: 6 digits, 30-second window, SHA1. */
const OPTIONS = {
  window: 1, // Allow tokens from adjacent time windows
};

/**
 * Generate a random base32 secret for TOTP enrollment (20 bytes).
 * otplib uses base32 encoding by default.
 */
export function generateSecret(): string {
  return generateSecret();
}

/**
 * Verify a TOTP token against the stored secret.
 * Returns true if the token matches within the configured window.
 */
export function verifyToken(secret: string, token: string): boolean {
  try {
    const result = verifySync(token, secret, OPTIONS);
    return result === "ok";
  } catch {
    return false;
  }
}

/**
 * Generate recovery codes as an array of uppercase hex strings.
 * Recovery codes are single-use and can be used to disable 2FA if the user loses access to their authenticator app.
 */
export function generateRecoveryCodes(count: number = DEFAULT_RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(RECOVERY_CODE_BYTES);
    codes.push(bytes.toString("hex").toUpperCase());
  }
  return codes;
}

/**
 * Generate an otpauth:// URL for QR code display.
 * This URL can be encoded as a QR code and scanned by authenticator apps (Google Authenticator, Authy, etc.).
 */
export function totpUrl(secret: string, email: string): string {
  // otplib v13 expects an object parameter with issuer, label, secret
  return generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });
}

/**
 * Generate a valid TOTP token for testing purposes.
 * This is useful in tests where you need to simulate an authenticator app.
 */
export function generateValidToken(secret: string): string {
  return generateSync(secret);
}

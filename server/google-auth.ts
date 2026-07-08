/**
 * Google OAuth token verification utility.
 * Verifies Google ID tokens using Google's tokeninfo endpoint
 * and validates audience (aud) and email verification status.
 */

export interface GoogleUser {
  sub: string;           // Google user ID (unique)
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || Bun.env.GOOGLE_CLIENT_ID;

/**
 * Verify a Google ID token credential.
 * Returns the Google user info if valid, null otherwise.
 */
export async function verifyGoogleToken(credential: string): Promise<GoogleUser | null> {
  if (!GOOGLE_CLIENT_ID) {
    console.error('GOOGLE_CLIENT_ID is not configured');
    return null;
  }

  try {
    // Verify via Google's tokeninfo endpoint
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );

    if (!res.ok) {
      console.warn('Google token verification failed:', res.status);
      return null;
    }

    const payload = await res.json();

    // Validate audience matches our client ID
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      console.warn('Google token audience mismatch');
      return null;
    }

    // Validate email is verified
    if (payload.email_verified !== 'true' && payload.email_verified !== true) {
      console.warn('Google email not verified');
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || '',
      email_verified: true
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    return null;
  }
}

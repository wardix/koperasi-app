import { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { sign, verify, decode } from 'hono/jwt'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import db from '../db'
import { loginSchema } from '../schemas'
import { secretKey, rateLimitLogin } from '../middleware'
import { verifyGoogleToken } from '../google-auth'
import { generateSecret, verifyToken, generateRecoveryCodes, totpUrl } from '../lib/totp'

const auth = new Hono()

auth.post('/login', async (c) => {
  let ip = 'unknown-ip';
  try {
    const info = getConnInfo(c);
    ip = info?.remote?.address || 'unknown-ip';
  } catch (e) {}

  if (!(await rateLimitLogin(ip))) {
    return c.json({ success: false, message: 'Too many login attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json()
    // Extend login schema to optionally include TOTP token
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { email, password } = parsed.data

    const admin = await db.query("SELECT * FROM admins WHERE email = ?").get(email) as any
    if (!admin) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401)
    }

    const isMatch = await Bun.password.verify(password, admin.password)
    if (!isMatch) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401)
    }

    // Check if user has 2FA enabled
    if (admin.two_factor_enabled) {
      const token = body.token;
      if (!token) {
        return c.json({
          success: true,
          requiresTotp: true,
          data: { userId: admin.id, email: admin.email }
        }, 200);
      }

      // Verify TOTP token
      const valid = verifyToken(admin.totp_secret, token);
      if (!valid) {
        return c.json({ success: false, message: 'Invalid two-factor authentication code' }, 401);
      }
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 15 * 60
    }
    const accessToken = await sign(payload, secretKey)

    const refreshPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }
    const refreshToken = await sign(refreshPayload, secretKey)

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return c.json({ success: true, message: 'Login successful', data: { token: accessToken, role: admin.role } })
  } catch (error) {
    throw error
  }
})

auth.post('/google', async (c) => {
  try {
    const body = await c.req.json();
    const { credential } = body;

    if (!credential) {
      return c.json({ success: false, message: 'Missing Google credential' }, 400);
    }

    // Verify Google ID token
    const googleUser = await verifyGoogleToken(credential);

    if (!googleUser) {
      return c.json({ success: false, message: 'Invalid Google token' }, 401);
    }

    // Look up admin by google_id or email
    let admin = await db.query(
      "SELECT * FROM admins WHERE google_id = ? OR email = ?"
    ).get(googleUser.sub, googleUser.email) as any;

    if (!admin) {
      // Check if SSO auto-register is allowed
      const ssoAutoRegister = await db.query(
        "SELECT value FROM settings WHERE key = 'ssoAutoRegister'"
      ).get() as any;

      if (ssoAutoRegister?.value === 'true') {
        // Auto-register new admin with viewer role
        const id = crypto.randomUUID();
        await db.run(
          `INSERT INTO admins (id, email, password, role, google_id, name, avatar_url, auth_provider)
           VALUES (?, ?, '', 'viewer', ?, ?, ?, 'google')`,
          [id, googleUser.email, googleUser.sub, googleUser.name, googleUser.picture]
        );
        admin = { id, email: googleUser.email, role: 'viewer' };
      } else {
        return c.json({
          success: false,
          message: 'Akun belum terdaftar. Hubungi admin untuk mendaftar.'
        }, 403);
      }
    } else if (!admin.google_id) {
      // Link Google account to existing admin (first Google login)
      await db.run(
        "UPDATE admins SET google_id = ?, name = COALESCE(name, ?), avatar_url = ?, auth_provider = 'google' WHERE id = ?",
        [googleUser.sub, googleUser.name, googleUser.picture, admin.id]
      );
    }

    // Issue JWT tokens (same as regular login)
    const payload = {
      sub: admin.id,
      email: admin.email || googleUser.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 15 * 60 // 15 minutes
    };
    const accessToken = await sign(payload, secretKey);

    const refreshPayload = {
      sub: admin.id,
      email: admin.email || googleUser.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
    };
    const refreshToken = await sign(refreshPayload, secretKey);

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return c.json({
      success: true,
      data: {
        token: accessToken,
        role: admin.role,
        name: googleUser.name,
        avatar: googleUser.picture
      }
    });
  } catch (error) {
    console.error('Google SSO error:', error);
    return c.json({ success: false, message: 'Authentication failed' }, 500);
  }
})

auth.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refreshToken')
  if (!refreshToken) {
    return c.json({ success: false, message: 'No refresh token' }, 401)
  }
  try {
    const payload = await verify(refreshToken, secretKey, 'HS256')
    const admin = await db.query("SELECT * FROM admins WHERE id = ?").get(payload.sub as string) as any
    if (!admin) {
      return c.json({ success: false, message: 'User no longer exists or has been deactivated' }, 401)
    }

    const newPayload = { 
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 15 * 60 
    }
    const newAccessToken = await sign(newPayload, secretKey)
    return c.json({ success: true, data: { token: newAccessToken } })
  } catch (err) {
    return c.json({ success: false, message: 'Invalid or expired refresh token' }, 401)
  }
})

auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { payload } = decode(token);
      let exp = Date.now() + 60 * 60 * 1000;
      if (payload && payload.exp) {
        exp = (payload.exp as number) * 1000;
      }
      await db.run("INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?) ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at", [token, exp]);
    } catch (e) {
      await db.run("INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?) ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at", [token, Date.now() + 60 * 60 * 1000]);
    }
  }
  deleteCookie(c, 'refreshToken', { path: '/' })
  return c.json({ success: true, message: 'Logout successful' })
})

auth.get('/verify', async (c) => {
  return c.json({ success: true, message: 'Token is valid' })
})

// ---------------------------------------------------------------------------
// TOTP Two-Factor Authentication Endpoints
// ---------------------------------------------------------------------------

/** GET /api/v1/auth/totp/status — Get current user's 2FA status */
auth.get('/totp/status', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email?: string } | undefined;
  if (!payload?.sub || !payload.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const admin = await db.query(
      "SELECT two_factor_enabled FROM admins WHERE id = ?"
    ).get(payload.sub) as any;

    return c.json({
      success: true,
      data: {
        twoFactorEnabled: admin?.two_factor_enabled || false
      }
    });
  } catch (error) {
    console.error('TOTP status error:', error);
    return c.json({ success: false, message: 'Failed to get TOTP status' }, 500);
  }
});

/** GET /api/v1/auth/totp/setup — Generate enrollment data for 2FA */
auth.get('/totp/setup', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email?: string } | undefined;
  if (!payload?.sub || !payload.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Generate new secret and recovery codes
    const secret = generateSecret();
    const recoveryCodes = generateRecoveryCodes(8);

    // Store in database (but don't enable 2FA yet)
    await db.run(
      `UPDATE admins SET totp_secret = ?, recovery_codes = ? WHERE id = ?`,
      [secret, JSON.stringify(recoveryCodes), payload.sub]
    );

    // Return URI for QR code generation and the secret as fallback
    const uri = totpUrl(secret, payload.email);

    return c.json({
      success: true,
      data: {
        uri,
        secret,
        recoveryCodes // Show once! User should save these.
      }
    });
  } catch (error) {
    console.error('TOTP setup error:', error);
    return c.json({ success: false, message: 'Failed to generate TOTP setup data' }, 500);
  }
});

/** POST /api/v1/auth/totp/verify — Verify enrollment token and enable 2FA */
auth.post('/totp/verify', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email?: string } | undefined;
  if (!payload?.sub || !payload.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { token } = body as { token?: string };

    if (!token) {
      return c.json({ success: false, message: 'Token is required' }, 400);
    }

    // Get stored secret for this user
    const admin = await db.query(
      "SELECT totp_secret FROM admins WHERE id = ?"
    ).get(payload.sub) as any;

    if (!admin?.totp_secret) {
      return c.json({ success: false, message: 'No TOTP setup found. Please start the enrollment process first.' }, 400);
    }

    // Verify token against stored secret
    const valid = verifyToken(admin.totp_secret, token);
    if (!valid) {
      return c.json({ success: false, message: 'Invalid verification code' }, 401);
    }

    // Enable 2FA
    await db.run(
      "UPDATE admins SET two_factor_enabled = TRUE WHERE id = ?",
      [payload.sub]
    );

    return c.json({ success: true, message: 'Two-factor authentication enabled successfully' });
  } catch (error) {
    console.error('TOTP verify error:', error);
    return c.json({ success: false, message: 'Failed to verify TOTP token' }, 500);
  }
});

/** POST /api/v1/auth/totp/disable — Disable 2FA using recovery code or current TOTP */
auth.post('/totp/disable', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email?: string } | undefined;
  if (!payload?.sub || !payload.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    const { recoveryCode, token } = body as { recoveryCode?: string; token?: string };

    if (!recoveryCode && !token) {
      return c.json({ success: false, message: 'Either recovery code or TOTP token is required' }, 400);
    }

    // Get admin record with recovery codes and secret
    const admin = await db.query(
      "SELECT totp_secret, recovery_codes FROM admins WHERE id = ?"
    ).get(payload.sub) as any;

    if (!admin?.totp_secret || !admin.recovery_codes) {
      return c.json({ success: false, message: 'Two-factor authentication is not enabled' }, 400);
    }

    let valid = false;

    // Try recovery code first (JSON array stored in DB)
    if (recoveryCode && admin.recovery_codes.length > 0) {
      try {
        const codes: string[] = JSON.parse(admin.recovery_codes);
        valid = codes.includes(recoveryCode.toUpperCase());
      } catch {
        // Invalid JSON format, ignore recovery code
      }
    }

    // Try TOTP token if recovery code didn't work
    if (!valid && token) {
      valid = verifyToken(admin.totp_secret, token);
    }

    if (!valid) {
      return c.json({ success: false, message: 'Invalid recovery code or TOTP token' }, 401);
    }

    // Disable 2FA and clear all related data
    await db.run(
      "UPDATE admins SET two_factor_enabled = FALSE, totp_secret = NULL, recovery_codes = '[]' WHERE id = ?",
      [payload.sub]
    );

    return c.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('TOTP disable error:', error);
    return c.json({ success: false, message: 'Failed to disable two-factor authentication' }, 500);
  }
});

/** POST /api/v1/auth/totp/recovery-codes — Regenerate recovery codes */
auth.post('/totp/recovery-codes', async (c) => {
  const payload = c.get('jwtPayload') as { sub: string; email?: string } | undefined;
  if (!payload?.sub || !payload.email) {
    return c.json({ success: false, message: 'Unauthorized' }, 401);
  }

  try {
    // Verify current TOTP token for security
    const admin = await db.query(
      "SELECT totp_secret FROM admins WHERE id = ?"
    ).get(payload.sub) as any;

    if (!admin?.totp_secret || !admin.two_factor_enabled) {
      return c.json({ success: false, message: 'Two-factor authentication is not enabled' }, 400);
    }

    const body = await c.req.json();
    const { token } = body as { token?: string };

    if (!token) {
      return c.json({ success: false, message: 'Current TOTP token is required to regenerate recovery codes' }, 400);
    }

    // Verify current TOTP token
    const valid = verifyToken(admin.totp_secret, token);
    if (!valid) {
      return c.json({ success: false, message: 'Invalid TOTP token' }, 401);
    }

    // Generate new recovery codes
    const newCodes = generateRecoveryCodes(8);

    // Update in database
    await db.run(
      "UPDATE admins SET recovery_codes = ? WHERE id = ?",
      [JSON.stringify(newCodes), payload.sub]
    );

    return c.json({ success: true, data: { recoveryCodes: newCodes } });
  } catch (error) {
    console.error('TOTP recovery codes error:', error);
    return c.json({ success: false, message: 'Failed to regenerate recovery codes' }, 500);
  }
});

export default auth

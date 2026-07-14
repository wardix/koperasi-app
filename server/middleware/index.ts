import { jwt, decode } from 'hono/jwt'
import { Context, Next } from 'hono'
import db from '../db'
import { hasPermission, type Permission } from '../../shared/permissions'

export const secretKey = process.env.JWT_SECRET || Bun.env.JWT_SECRET;
if (!secretKey) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const authMiddleware = async (c: Context, next: Next) => {
  if (
    c.req.path === '/api/v1/login' ||
    c.req.path === '/api/v1/logout' ||
    c.req.path === '/api/v1/refresh' ||
    c.req.path === '/api/v1/auth/google' ||
    c.req.path === '/api/v1/google'
  ) {
    return next()
  }

  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // Decode token to extract jti for blacklist check (without full verification)
    try {
      const decoded = decode(token);
      const jti = decoded.payload?.jti as string | undefined;

      if (jti) {
        // Check blacklist by jti_token instead of full JWT string
        const blacklisted = await db.query(
          "SELECT 1 FROM token_blacklist WHERE jti_token = ?",
          [jti]
        ).get();
        if (blacklisted) {
          return c.json({ success: false, message: 'Token is blacklisted' }, 401);
        }
      }
    } catch (e) {
      // If decoding fails, JWT middleware will handle it later
      console.warn('Failed to decode token for blacklist check:', e);
    }
  }

  const jwtMiddleware = jwt({
    secret: secretKey,
    alg: 'HS256',
  })
  return jwtMiddleware(c, next)
}

export const requirePermission = (permission: Permission) => {
  return async (c: Context, next: Next) => {
    const payload = c.get('jwtPayload')
    if (!payload || !payload.role) {
      return c.json({ success: false, message: 'Unauthorized' }, 401)
    }

    if (!hasPermission(payload.role, permission)) {
      return c.json({ success: false, message: `Forbidden: requires ${permission} permission` }, 403)
    }

    return next()
  }
}

export const requireAdmin = async (c: Context, next: Next) => {
  const payload = c.get('jwtPayload')
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403)
  }
  return next()
}

export async function rateLimitLogin(ip: string): Promise<boolean> {
  const rateLimitEnabled = (process.env.RATE_LIMIT_ENABLED ?? Bun.env.RATE_LIMIT_ENABLED ?? 'true') !== 'false';
  if (!rateLimitEnabled || process.env.BYPASS_RATE_LIMIT === 'true' || Bun.env.BYPASS_RATE_LIMIT === 'true') {
    return true;
  }
  const now = Date.now();
  const limit = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes

  let attempt = await db.query("SELECT * FROM rate_limits WHERE ip = ?").get(ip) as any;
  
  if (!attempt) {
    await db.run("INSERT INTO rate_limits (ip, count, reset_at) VALUES (?, 1, ?)", [ip, now + windowMs]);
    return true;
  }

  if (now > attempt.reset_at) {
    await db.run("INSERT INTO rate_limits (ip, count, reset_at) VALUES ($2, 1, $1) ON CONFLICT (ip) DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at", [now + windowMs, ip]);
    return true;
  }

  const newCount = attempt.count + 1;
  await db.run("UPDATE rate_limits SET count = ? WHERE ip = ?", [newCount, ip]);
  
  if (newCount > limit) {
    return false;
  }

  return true;
}

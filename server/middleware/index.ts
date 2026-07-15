import { jwt, decode } from 'hono/jwt'
import { getConnInfo } from 'hono/bun'
import { Context, Next } from 'hono'
import db from '../db'
import { hasPermission, type Permission } from '../../shared/permissions'
import type { AppVariables, JwtPayload } from '../types/auth'

export const secretKey: string = process.env.JWT_SECRET || Bun.env.JWT_SECRET || '';
if (!secretKey) {
  throw new Error('JWT_SECRET environment variable is required');
}

type AppContext = Context<{ Variables: AppVariables }>

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
          "SELECT 1 FROM token_blacklist WHERE jti_token = ?"
        ).get(jti);
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
  return async (c: AppContext, next: Next) => {
    const payload = c.get('jwtPayload') as JwtPayload | undefined
    if (!payload || !payload.role) {
      return c.json({ success: false, message: 'Unauthorized' }, 401)
    }

    if (!hasPermission(payload.role, permission)) {
      return c.json({ success: false, message: `Forbidden: requires ${permission} permission` }, 403)
    }

    return next()
  }
}

export const requireAdmin = async (c: AppContext, next: Next) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403)
  }
  return next()
}

/**
 * Atomic rate limit check using PostgreSQL's ON CONFLICT ... DO UPDATE RETURNING.
 * This is race-safe because the entire operation (check + increment) happens in a single SQL statement.
 *
 * @param key - Unique identifier for the rate limit bucket (e.g., 'ip:192.168.1.1', 'account:user123')
 * @param limit - Maximum number of requests allowed within the window
 * @param windowMs - Window duration in milliseconds
 * @returns true if request is allowed, false if rate limited (429)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const enabled = (process.env.RATE_LIMIT_ENABLED ?? Bun.env.RATE_LIMIT_ENABLED ?? 'true') !== 'false';
  if (!enabled || process.env.BYPASS_RATE_LIMIT === 'true' || Bun.env.BYPASS_RATE_LIMIT === 'true') {
    return true;
  }

  const now = Date.now();

  // Atomic upsert: increment count atomically, reset window if expired
  // ON CONFLICT uses the primary key (ip column) to determine if it's an insert or update
  const result = await db.query(
    `INSERT INTO rate_limits (ip, count, reset_at)
     VALUES (?, 1, ?)
     ON CONFLICT (ip) DO UPDATE SET
       count = CASE
         WHEN rate_limits.reset_at < ? THEN 1
         ELSE rate_limits.count + 1
       END,
       reset_at = CASE
         WHEN rate_limits.reset_at < ? THEN ?
         ELSE rate_limits.reset_at
       END
     RETURNING count`
  ).get<{ count: number }>(key, now + windowMs, now, now, now + windowMs);

  const currentCount = result?.count ?? 1;

  // Return false (rate limited) if limit exceeded
  return currentCount <= limit;
}

/**
 * @deprecated Use checkRateLimit(key, limit, windowMs) instead for atomic race-safe rate limiting.
 * Kept for backward compatibility with existing code.
 */
export async function rateLimitLogin(ip: string): Promise<boolean> {
  return checkRateLimit(`ip:${ip}`, 5, 15 * 60 * 1000);
}

/**
 * Global API rate limiter (optional, disabled by default).
 * Use when NOT behind nginx reverse proxy with its own rate limiting.
 *
 * When RATE_LIMIT_ENABLED=true AND this middleware is applied:
 * - All /api/v1/* requests are rate limited to 60 req/min per IP
 * - Prevents API abuse when deployed without reverse proxy
 *
 * Set GLOBAL_API_RATE_LIMIT=false or remove this middleware from server/index.ts
 * if using nginx or other reverse proxy for rate limiting.
 */
export const apiRateLimit = async (c: Context, next: Next) => {
  // Check if global API rate limit is enabled
  const globalApiLimitEnabled = process.env.GLOBAL_API_RATE_LIMIT === 'true' || Bun.env.GLOBAL_API_RATE_LIMIT === 'true';

  if (!globalApiLimitEnabled) {
    return next(); // Skip rate limiting when behind nginx or disabled
  }

  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    (() => {
      try {
        return getConnInfo(c).remote?.address || 'unknown-ip';
      } catch {
        return 'unknown-ip';
      }
    })();
  const allowed = await checkRateLimit(`api:${ip}`, 60, 60 * 1000); // 60 req/min per IP

  if (!allowed) {
    return c.json({ success: false, message: 'Too many requests. Please try again later.' }, 429);
  }

  return next();
};

import { jwt, decode } from 'hono/jwt'
import { Context, Next } from 'hono'
import db from '../db'

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
    const blacklisted = db.query("SELECT 1 FROM token_blacklist WHERE token = ?").get(token);
    if (blacklisted) {
      return c.json({ success: false, message: 'Token is blacklisted' }, 401);
    }
  }

  const jwtMiddleware = jwt({
    secret: secretKey,
    alg: 'HS256',
  })
  return jwtMiddleware(c, next)
}

export const requireAdmin = async (c: Context, next: Next) => {
  const payload = c.get('jwtPayload')
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403)
  }
  return next()
}

export function rateLimitLogin(ip: string): boolean {
  const now = Date.now();
  const limit = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes

  let attempt = db.query("SELECT * FROM rate_limits WHERE ip = ?").get(ip) as any;
  
  if (!attempt) {
    db.run("INSERT INTO rate_limits (ip, count, reset_at) VALUES (?, 1, ?)", [ip, now + windowMs]);
    return true;
  }

  if (now > attempt.reset_at) {
    db.run("UPDATE rate_limits SET count = 1, reset_at = ? WHERE ip = ?", [now + windowMs, ip]);
    return true;
  }

  const newCount = attempt.count + 1;
  db.run("UPDATE rate_limits SET count = ? WHERE ip = ?", [newCount, ip]);
  
  if (newCount > limit) {
    return false;
  }

  return true;
}

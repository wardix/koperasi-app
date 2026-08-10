import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import db from './db'
import { authMiddleware, apiRateLimit } from './middleware'

import authRoutes from './routes/auth'
import membersRoutes from './routes/members'
import loansRoutes from './routes/loans'
import settingsRoutes from './routes/settings'
import shuRoutes from './routes/shu'
import statsRoutes from './routes/stats'
import adminsRoutes from './routes/admins'
import savingsRoutes from './routes/savings'
import cashflowRoutes from './routes/cashflow'
import nplRoutes from './routes/npl'
import reportsRoutes from './routes/reports'
import auditRoutes from './routes/audit'
import accountingRoutes from './routes/accounting'
import docsRoutes from './routes/docs'
import memberAuthRoutes from './routes/memberAuth'
import cronRoutes from './routes/cron'
import memberSelfServiceRoutes from './routes/memberSelfService'
import { registerLegacyAuthAliases } from './lib/authLegacy'

import { HTTPException } from 'hono/http-exception'

const app = new Hono()

app.onError((err, c) => {
  console.error(err)
  if (err instanceof SyntaxError) {
    return c.json({ success: false, message: 'Invalid JSON payload' }, 400)
  }
  if (err instanceof HTTPException) {
    return c.json({ success: false, message: err.message }, err.status)
  }
  return c.json({ success: false, message: 'Internal Server Error' }, 500)
})

app.get('/health', async (c) => {
  try {
    await db.query("SELECT 1").get();
    return c.json({
      status: 'ok',
      database: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      database: 'error',
      message: error instanceof Error ? error.message : String(error),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }, 500);
  }
})

app.use('*', secureHeaders())

const allowedOrigins = (process.env.CORS_ORIGIN || Bun.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use('/*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}))

const cleanupTokenBlacklist = async () => {
  const now = Date.now();
  // Clean up expired access token blacklists (by jti_token)
  await db.run("DELETE FROM token_blacklist WHERE expires_at < ?", [now]);
};

const tokenCleanupInterval = setInterval(cleanupTokenBlacklist, 60 * 60 * 1000); // 1 hour
if (typeof tokenCleanupInterval.unref === 'function') {
  tokenCleanupInterval.unref();
}

// Cleanup expired refresh tokens from refresh_token_blacklist
const cleanupRefreshTokenBlacklist = async () => {
  const now = Date.now();
  await db.run("DELETE FROM refresh_token_blacklist WHERE expires_at < ?", [now]);
};

const refreshTokenCleanupInterval = setInterval(cleanupRefreshTokenBlacklist, 60 * 60 * 1000); // 1 hour
if (typeof refreshTokenCleanupInterval.unref === 'function') {
  refreshTokenCleanupInterval.unref();
}

const cleanupAttempts = async () => {
  const now = Date.now();
  await db.run("DELETE FROM rate_limits WHERE reset_at < ?", [now]);
};

const cleanupInterval = setInterval(cleanupAttempts, 15 * 60 * 1000); // run every 15 minutes
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

export const _test = {
  cleanupAttempts,
  cleanupTokenBlacklist,
  cleanupRefreshTokenBlacklist
};

app.use('/api/v1/*', authMiddleware)

// Optional global API rate limiting (disabled by default, enable via GLOBAL_API_RATE_LIMIT=true)
// When behind nginx reverse proxy with rate limiting, this can be disabled
app.use('/api/v1/*', apiRateLimit)

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/cron', cronRoutes)
app.route('/api/v1/member-auth', memberAuthRoutes)
app.route('/api/v1/portal', memberSelfServiceRoutes)
registerLegacyAuthAliases(app)
app.route('/api/v1/members', membersRoutes)
app.route('/api/v1/loans', loansRoutes)
app.route('/api/v1/settings', settingsRoutes)
app.route('/api/v1/shu', shuRoutes)
app.route('/api/v1/stats', statsRoutes)
app.route('/api/v1/admins', adminsRoutes)
app.route('/api/v1/savings', savingsRoutes)
app.route('/api/v1/cashflow', cashflowRoutes)
app.route('/api/v1/npl', nplRoutes)
app.route('/api/v1/reports', reportsRoutes)
app.route('/api/v1/audit-logs', auditRoutes)
app.route('/api/v1/accounting', accountingRoutes)

// OpenAPI spec + Swagger UI (development only)
if (process.env.NODE_ENV !== 'production') {
  app.route('/', docsRoutes)
}

const port = parseInt(process.env.PORT || '3000', 10)

console.log(`Hono server running on http://localhost:${port}`)
console.log(`Started development server: http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
}

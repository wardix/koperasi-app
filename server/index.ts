import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import db from './db'
import { authMiddleware } from './middleware'

import authRoutes from './routes/auth'
import membersRoutes from './routes/members'
import loansRoutes from './routes/loans'
import settingsRoutes from './routes/settings'
import shuRoutes from './routes/shu'
import statsRoutes from './routes/stats'

const app = new Hono()

app.get('/health', (c) => {
  try {
    db.query("SELECT 1").get();
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

const cleanupTokenBlacklist = () => {
  const now = Date.now();
  db.run("DELETE FROM token_blacklist WHERE expires_at < ?", [now]);
};

const tokenCleanupInterval = setInterval(cleanupTokenBlacklist, 60 * 60 * 1000); // 1 hour
if (typeof tokenCleanupInterval.unref === 'function') {
  tokenCleanupInterval.unref();
}

const cleanupAttempts = () => {
  const now = Date.now();
  db.run("DELETE FROM rate_limits WHERE reset_at < ?", [now]);
};

const cleanupInterval = setInterval(cleanupAttempts, 15 * 60 * 1000); // run every 15 minutes
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

export const _test = {
  cleanupAttempts,
  cleanupTokenBlacklist
};

app.use('/api/*', authMiddleware)

app.route('/api', authRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/members', membersRoutes)
app.route('/api/loans', loansRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/shu', shuRoutes)
app.route('/api/stats', statsRoutes)

console.log('Hono server running on http://localhost:3000')

export default {
  port: 3000,
  fetch: app.fetch,
}

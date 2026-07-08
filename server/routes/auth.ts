import { Hono } from 'hono'
import { getConnInfo } from 'hono/bun'
import { sign, verify, decode } from 'hono/jwt'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import db from '../db'
import { loginSchema } from '../schemas'
import { secretKey, rateLimitLogin } from '../middleware'

const auth = new Hono()

auth.post('/login', async (c) => {
  let ip = 'unknown-ip';
  try {
    const info = getConnInfo(c);
    ip = info?.remote?.address || 'unknown-ip';
  } catch (e) {}
  
  if (!rateLimitLogin(ip)) {
    return c.json({ success: false, message: 'Too many login attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { email, password } = parsed.data
    
    const admin = db.query("SELECT * FROM admins WHERE email = ?").get(email) as any
    if (!admin) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401)
    }

    const isMatch = await Bun.password.verify(password, admin.password)
    if (!isMatch) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401)
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

auth.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refreshToken')
  if (!refreshToken) {
    return c.json({ success: false, message: 'No refresh token' }, 401)
  }
  try {
    const payload = await verify(refreshToken, secretKey, 'HS256')
    const admin = db.query("SELECT * FROM admins WHERE id = ?").get(payload.sub as string) as any
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

auth.post('/logout', (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { payload } = decode(token);
      let exp = Date.now() + 60 * 60 * 1000;
      if (payload && payload.exp) {
        exp = (payload.exp as number) * 1000;
      }
      db.run("INSERT OR REPLACE INTO token_blacklist (token, expires_at) VALUES (?, ?)", [token, exp]);
    } catch (e) {
      db.run("INSERT OR REPLACE INTO token_blacklist (token, expires_at) VALUES (?, ?)", [token, Date.now() + 60 * 60 * 1000]);
    }
  }
  deleteCookie(c, 'refreshToken', { path: '/' })
  return c.json({ success: true, message: 'Logout successful' })
})

auth.get('/verify', (c) => {
  return c.json({ success: true, message: 'Token is valid' })
})

export default auth

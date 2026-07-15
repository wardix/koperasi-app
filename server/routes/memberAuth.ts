import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import db from '../db';
import type { MemberRow } from '../db/entities';
import { loginSchema } from '../schemas';
import { secretKey, checkRateLimit } from '../middleware';
import { getClientIp } from '../lib/audit';

const memberAuth = new Hono();

memberAuth.post('/login', async (c) => {
  const ip = getClientIp(c);

  if (!(await checkRateLimit(`member-login:${ip}`, 5, 15 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many login attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400);
    }

    const { email, password } = parsed.data;

    // A member can log in using their email or their ID (NIP) mapped to the email field in the login form
    const member = await db.query("SELECT * FROM members WHERE (email = ? OR id = ?) AND deletedAt IS NULL").get<MemberRow>(email, email);
    
    if (!member || !member.password) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    const isMatch = await Bun.password.verify(password, member.password);
    if (!isMatch) {
      return c.json({ success: false, message: 'Invalid credentials' }, 401);
    }

    if (member.status !== 'Aktif') {
      return c.json({ success: false, message: 'Akun anggota tidak aktif.' }, 403);
    }

    const payload = {
      sub: member.id,
      email: member.email,
      role: 'member', // Member role is distinct from admin RBAC
      name: member.name,
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };
    
    const accessToken = await sign(payload, secretKey);

    const refreshPayload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };
    const refreshToken = await sign(refreshPayload, secretKey);

    setCookie(c, 'memberRefreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return c.json({ success: true, message: 'Login successful', data: { token: accessToken, role: 'member', memberId: member.id, name: member.name } });
  } catch (error) {
    console.error('Member login error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

memberAuth.post('/refresh', async (c) => {
  const refreshIp = getClientIp(c);

  if (!(await checkRateLimit(`member-refresh:${refreshIp}`, 30, 60 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many refresh attempts.' }, 429);
  }

  const refreshToken = getCookie(c, 'memberRefreshToken');
  if (!refreshToken) {
    return c.json({ success: false, message: 'No refresh token' }, 401);
  }

  try {
    const decodedRefresh = await verify(refreshToken, secretKey, 'HS256');
    const memberId = decodedRefresh.sub as string;

    if (decodedRefresh.role !== 'member') {
      return c.json({ success: false, message: 'Invalid refresh token role' }, 401);
    }

    const member = await db.query("SELECT * FROM members WHERE id = ? AND deletedAt IS NULL").get<MemberRow>(memberId);
    if (!member || member.status !== 'Aktif') {
      return c.json({ success: false, message: 'User no longer valid' }, 401);
    }

    const payload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      name: member.name,
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    };
    const newAccessToken = await sign(payload, secretKey);

    const refreshPayload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };
    const newRefreshToken = await sign(refreshPayload, secretKey);

    setCookie(c, 'memberRefreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    });

    return c.json({ success: true, data: { token: newAccessToken } });
  } catch (err) {
    return c.json({ success: false, message: 'Invalid refresh token' }, 401);
  }
});

memberAuth.post('/logout', async (c) => {
  deleteCookie(c, 'memberRefreshToken', { path: '/' });
  return c.json({ success: true, message: 'Logout successful' });
});

export default memberAuth;

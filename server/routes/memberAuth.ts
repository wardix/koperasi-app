import { Hono } from 'hono';
import type { Context } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import db from '../db';
import type { MemberRow } from '../db/entities';
import { loginSchema } from '../schemas';
import { secretKey, checkRateLimit } from '../middleware';
import { getClientIp } from '../lib/audit';
import { verifyGoogleToken } from '../google-auth';
import {
  accessTokenExpUnix,
  refreshTokenExpUnix,
  REFRESH_TOKEN_TTL_SEC,
  ACCESS_TOKEN_TTL_SEC,
} from '../lib/tokenTtl';

const memberAuth = new Hono();

async function issueMemberSession(c: Context, member: MemberRow) {
  const payload = {
    sub: member.id,
    email: member.email,
    role: 'member' as const,
    name: member.name,
    exp: accessTokenExpUnix(),
  };

  const accessToken = await sign(payload, secretKey);

  const refreshPayload = {
    sub: member.id,
    email: member.email,
    role: 'member' as const,
    exp: refreshTokenExpUnix(),
  };
  const refreshToken = await sign(refreshPayload, secretKey);

  setCookie(c, 'memberRefreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: REFRESH_TOKEN_TTL_SEC,
    path: '/',
  });

  return {
    token: accessToken,
    role: 'member' as const,
    memberId: member.id,
    name: member.name,
    isMember: true,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

async function issueEmployeeSession(c: Context, employee: { id: string; email: string; name: string; is_member?: boolean; member_id?: string | null }) {
  const payload = {
    sub: employee.member_id || employee.id,
    email: employee.email,
    role: 'member' as const,
    name: employee.name,
    employeeId: employee.id,
    exp: accessTokenExpUnix(),
  };

  const accessToken = await sign(payload, secretKey);

  const refreshPayload = {
    sub: employee.member_id || employee.id,
    email: employee.email,
    role: 'member' as const,
    employeeId: employee.id,
    exp: refreshTokenExpUnix(),
  };
  const refreshToken = await sign(refreshPayload, secretKey);

  setCookie(c, 'memberRefreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: REFRESH_TOKEN_TTL_SEC,
    path: '/',
  });

  return {
    token: accessToken,
    role: 'member' as const,
    memberId: employee.member_id || employee.id,
    employeeId: employee.id,
    name: employee.name,
    isMember: Boolean(employee.is_member),
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  };
}

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

    const data = await issueMemberSession(c, member);
    return c.json({ success: true, message: 'Login successful', data });
  } catch (error) {
    console.error('Member login error:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
});

/**
 * Member & Employee Google SSO:
 * 1. Match verified Google email to members.email (Cooperative Member).
 * 2. If not found in members, match to company_employees.email (Company Employee EWA).
 */
memberAuth.post('/google', async (c) => {
  const ssoIp = getClientIp(c);

  if (!(await checkRateLimit(`member-sso:${ssoIp}`, 5, 15 * 60 * 1000))) {
    return c.json({ success: false, message: 'Too many SSO attempts. Please try again later.' }, 429);
  }

  try {
    const body = await c.req.json();
    const credential = body?.credential as string | undefined;
    if (!credential) {
      return c.json({ success: false, message: 'Missing Google credential' }, 400);
    }

    const googleUser = await verifyGoogleToken(credential);
    if (!googleUser) {
      return c.json({ success: false, message: 'Invalid Google token' }, 401);
    }

    const email = googleUser.email.trim().toLowerCase();
    
    // 1. Check cooperative members first
    const member = await db
      .query(
        `SELECT * FROM members
         WHERE deletedAt IS NULL
           AND email IS NOT NULL
           AND lower(email) = ?
         LIMIT 1`
      )
      .get<MemberRow>(email);

    if (member) {
      if (member.status !== 'Aktif') {
        return c.json({ success: false, message: 'Akun anggota tidak aktif.' }, 403);
      }

      const data = await issueMemberSession(c, member);
      return c.json({
        success: true,
        message: 'Login successful',
        data: {
          ...data,
          googleName: googleUser.name,
        },
      });
    }

    // 2. Check company employees (for non-member EWA access)
    const employee = await db
      .query(
        `SELECT id, nip, name, email, is_member, member_id, status 
         FROM employees 
         WHERE lower(email) = ? AND lower(status) = 'active' 
         LIMIT 1`
      )
      .get<any>(email);

    if (employee) {
      const data = await issueEmployeeSession(c, employee);
      return c.json({
        success: true,
        message: 'Login successful (Karyawan Perusahaan)',
        data: {
          ...data,
          googleName: googleUser.name,
        },
      });
    }

    return c.json(
      {
        success: false,
        message:
          'Email Google tidak terdaftar sebagai Anggota Koperasi maupun Karyawan Perusahaan. Hubungi HRD / Pengurus Koperasi.',
      },
      403
    );
  } catch (error) {
    console.error('Member/Employee Google SSO error:', error);
    return c.json({ success: false, message: 'Authentication failed' }, 500);
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
      exp: accessTokenExpUnix(),
    };
    const newAccessToken = await sign(payload, secretKey);

    const refreshPayload = {
      sub: member.id,
      email: member.email,
      role: 'member',
      exp: refreshTokenExpUnix(),
    };
    const newRefreshToken = await sign(refreshPayload, secretKey);

    setCookie(c, 'memberRefreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: REFRESH_TOKEN_TTL_SEC,
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

import type { MemberRow, LoanRow, DashboardData, SettingsData } from "../shared/types";
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign, verify, decode } from 'hono/jwt'
import { secureHeaders } from 'hono/secure-headers'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import db from './db'
import { z } from 'zod'
import xss from 'xss'

const app = new Hono()

app.get('/health', (c) => {
  try {
    // Check database health
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

// Use CORS middleware to allow requests from Vite
app.use('/*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}))

const secretKey = process.env.JWT_SECRET || Bun.env.JWT_SECRET;

if (!secretKey) {
  throw new Error('JWT_SECRET environment variable is required');
}
const tokenBlacklist = new Map<string, number>();

const cleanupTokenBlacklist = () => {
  const now = Date.now();
  for (const [token, expiry] of tokenBlacklist) {
    if (expiry < now) {
      tokenBlacklist.delete(token);
    }
  }
};

const tokenCleanupInterval = setInterval(cleanupTokenBlacklist, 60 * 60 * 1000); // 1 hour
if (typeof tokenCleanupInterval.unref === 'function') {
  tokenCleanupInterval.unref();
}

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/login' || c.req.path === '/api/logout' || c.req.path === '/api/refresh') {
    return next()
  }
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (tokenBlacklist.has(token)) {
      return c.json({ success: false, message: 'Token is blacklisted' }, 401);
    }
  }

  const jwtMiddleware = jwt({
    secret: secretKey,
    alg: 'HS256',
  })
  return jwtMiddleware(c, next)
})

const requireAdmin = async (c: any, next: any) => {
  const payload = c.get('jwtPayload')
  if (!payload || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return c.json({ success: false, message: 'Forbidden: admin access required' }, 403)
  }
  return next()
}

// Zod schemas
const memberSchema = z.object({
  name: z.string().min(1, "Name is required").transform(xss),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required").transform(xss),
  simpananPokok: z.number().nonnegative().default(0),
  simpananWajib: z.number().nonnegative().default(0),
  simpananSukarela: z.number().nonnegative().default(0),
  totalSavings: z.number().nonnegative().optional(),
})

const savingsSchema = z.object({
  additionalSavings: z.union([
    z.number(),
    z.string().regex(/^-?\d+$/).transform(val => parseInt(val, 10))
  ]),
  savingsType: z.enum(["pokok", "wajib", "sukarela"]).default("sukarela")
})

const loanSchema = z.object({
  memberId: z.string().min(1, "Member ID is required").transform(xss),
  name: z.string().min(1, "Name is required").transform(xss),
  amount: z.number().positive(),
  tenor: z.string().min(1, "Tenor is required").transform(xss),
  purpose: z.string().min(1, "Purpose is required").transform(xss),
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]).default("Menunggu")
})

const loanStatusSchema = z.object({
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1).transform(xss)
})

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

const settingsSchema = z.record(z.union([z.string().transform(xss), z.boolean(), z.number()]))

function parsePagination(pageStr?: string, limitStr?: string) {
  const MAX_LIMIT = 100;
  const DEFAULT_LIMIT = 20;
  return {
    page: Math.max(1, parseInt(pageStr || '1') || 1),
    limit: Math.min(MAX_LIMIT, Math.max(1, parseInt(limitStr || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT)),
  };
}

// Get all members
app.get('/api/members', (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  
  const members = db.query("SELECT * FROM members ORDER BY rowid DESC LIMIT ? OFFSET ?").all(limit, offset)
  const totalRes = db.query("SELECT COUNT(*) as count FROM members").get() as { count: number }
  
  return c.json({
    data: members,
    total: totalRes.count,
    page,
    limit
  })
})

// Delete a member
app.delete('/api/members/:id', requireAdmin, (c) => {
  const id = c.req.param('id')
  try {
    db.query("DELETE FROM members WHERE id = ?").run(id)
    return c.json({ success: true })
  } catch (err: any) {
    if (err.message && err.message.includes("FOREIGN KEY constraint failed")) {
      return c.json({ success: false, message: 'Anggota memiliki pinjaman, hapus pinjaman terlebih dahulu.' }, 400)
    }
    return c.json({ success: false, message: 'Gagal menghapus anggota' }, 500)
  }
})

// Create a new member
app.post('/api/members', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela } = parsed.data
    const totalSavings = simpananPokok + simpananWajib + simpananSukarela
    const id = crypto.randomUUID()

    const insert = db.prepare(`
      INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    insert.run(id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
    
    return c.json({ success: true, message: 'Member created successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Update member
app.put('/api/members/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela } = parsed.data
    const totalSavings = simpananPokok + simpananWajib + simpananSukarela

    const update = db.prepare(`
      UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?, simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ?
      WHERE id = ?
    `)
    
    update.run(name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings, id)
    
    return c.json({ success: true, message: 'Member updated successfully' })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})


// Update member savings
app.put('/api/members/:id/savings', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = savingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { additionalSavings, savingsType } = parsed.data

    // get current
    const member = db.query("SELECT simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?").get(id) as {simpananPokok: number, simpananWajib: number, simpananSukarela: number, totalSavings: number}
    if (!member) return c.json({success: false, message: 'Not found'}, 404)

    const additionalSavingsNum = Number(additionalSavings)
    let newPokok = member.simpananPokok
    let newWajib = member.simpananWajib
    let newSukarela = member.simpananSukarela
    
    if (savingsType === 'pokok') newPokok += additionalSavingsNum
    else if (savingsType === 'wajib') newWajib += additionalSavingsNum
    else newSukarela += additionalSavingsNum
    
    if (newPokok < 0 || newWajib < 0 || newSukarela < 0) {
      return c.json({ success: false, message: "Saldo tidak mencukupi" }, 400)
    }
    
    const newTotal = newPokok + newWajib + newSukarela

    db.transaction(() => {
      db.query("UPDATE members SET simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ? WHERE id = ?").run(newPokok, newWajib, newSukarela, newTotal, id)
      db.query(`
        INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        additionalSavingsNum >= 0 ? `setor_${savingsType}` : `tarik_${savingsType}`,
        Math.abs(additionalSavingsNum),
        member.totalSavings,
        newTotal,
        new Date().toISOString(),
        (c.get('jwtPayload') as any)?.email || 'admin' // extract from jwt
      )
    })()
    
    return c.json({ success: true, newTotal })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Get member transactions
app.get('/api/members/:id/transactions', (c) => {
  const id = c.req.param('id')
  const rows = db.query("SELECT * FROM transactions WHERE memberId = ? ORDER BY createdAt DESC").all(id)
  return c.json(rows)
})

// Get all loans
app.get('/api/loans', (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const bungaSetting = db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '0');

  const loans = db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount 
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    GROUP BY l.id
    ORDER BY l.rowid DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]
  
  const mappedLoans = loans.map(loan => {
    const tenorMonths = parseInt(loan.tenor) || 1;
    // Flat interest calculation: (pokok * (bungaRate / 100)) * tenor
    const interestAmount = Math.round(loan.amount * (bungaRate / 100) * tenorMonths);
    const totalAmount = loan.amount + interestAmount;
    
    return {
      ...loan,
      interestAmount,
      totalAmount
    }
  });

  const totalRes = db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number }

  return c.json({
    data: mappedLoans,
    total: totalRes.count,
    page,
    limit
  })
})

// Create a new loan
app.post('/api/loans', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loanSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { memberId, name, amount, tenor, purpose, status } = parsed.data
    const id = crypto.randomUUID()

    const insert = db.prepare(`
      INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    insert.run(id, memberId, name, amount, tenor, purpose, status)
    
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Update loan status
app.put('/api/loans/:id/status', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = loanStatusSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { status } = parsed.data

    const update = db.prepare(`
      UPDATE loans SET status = ? WHERE id = ?
    `)
    update.run(status, id)
    
    return c.json({ success: true, message: 'Loan status updated' })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Get loan payments
app.get('/api/loans/:id/payments', (c) => {
  const id = c.req.param('id')
  const payments = db.query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC").all(id)
  return c.json(payments)
})

// Create loan payment
app.post('/api/loans/:id/payments', requireAdmin, async (c) => {
  try {
    const loanId = c.req.param('id')
    const body = await c.req.json()
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { amount, method } = parsed.data
    
    // validate overpayment
    const loan = db.query("SELECT amount, tenor FROM loans WHERE id = ?").get(loanId) as { amount: number, tenor: string } | null;
    if (!loan) return c.json({ success: false, message: 'Loan not found' }, 404);

    const bungaSetting = db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
    const bungaRate = parseFloat(bungaSetting?.value || '0');
    const tenorMonths = parseInt(loan.tenor) || 1;
    const interestAmount = Math.round(loan.amount * (bungaRate / 100) * tenorMonths);
    const totalAmount = loan.amount + interestAmount;
    
    const paid = (db.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get(loanId) as any).paid || 0;
    
    if (paid + amount > totalAmount) {
      return c.json({ success: false, message: 'Total pembayaran melebihi jumlah pinjaman' }, 400);
    }
    
    const id = crypto.randomUUID()
    const paymentDate = new Date().toISOString()

    const insert = db.prepare(`
      INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    insert.run(id, loanId, amount, paymentDate, method)
    
    return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Get dashboard stats
app.get('/api/stats', (c) => {
  const activeMembers = (db.query("SELECT COUNT(*) as c FROM members WHERE status = 'Aktif'").get() as any).c || 0;
  const totalSavings = (db.query("SELECT SUM(totalSavings) as s FROM members").get() as any).s || 0;
  const totalLoans = (db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Disetujui'").get() as any).s || 0;
  
  const totalMacet = (db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet'").get() as any).s || 0;
  const totalActiveLoans = totalLoans + totalMacet;
  const nplValue = totalActiveLoans > 0 ? ((totalMacet / totalActiveLoans) * 100).toFixed(1) + '%' : '0.0%';

  const roleRows = db.query("SELECT role, COUNT(*) as count FROM members GROUP BY role").all() as any[];
  const roleData = roleRows.map((r, i) => ({
    label: r.role,
    value: r.count,
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const purposeRows = db.query("SELECT purpose, COUNT(*) as count FROM loans GROUP BY purpose").all() as any[];
  const purposeData = purposeRows.map((r, i) => ({
    label: r.purpose,
    value: r.count,
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = d.toISOString().substring(0, 7);
    months.push(monthStr);
  }

  const txRows = db.query(`
    SELECT strftime('%Y-%m', createdAt) as month, SUM(amount) as total
    FROM transactions 
    WHERE type LIKE 'setor_%'
    GROUP BY month
  `).all() as { month: string, total: number }[];

  const paymentRows = db.query(`
    SELECT strftime('%Y-%m', paymentDate) as month, SUM(amount) as total
    FROM loan_payments
    GROUP BY month
  `).all() as { month: string, total: number }[];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyData = months.map(m => {
    const d = new Date(m + "-01");
    const label = monthNames[d.getMonth()];
    const tx = txRows.find(r => r.month === m);
    const pm = paymentRows.find(r => r.month === m);
    return {
      label,
      simpanan: tx ? tx.total : 0,
      pinjaman: pm ? pm.total : 0
    };
  });
  
  const recentRows = db.query("SELECT id, name, totalSavings, joinDate FROM members ORDER BY rowid DESC LIMIT 5").all() as any[];
  const recentActivities = recentRows.map(m => ({
    id: m.id,
    activity: 'Anggota Baru',
    name: m.name,
    amount: m.totalSavings,
    date: m.joinDate,
  }))

  const formatRp = (val: number) => 'Rp ' + (val / 1000000).toFixed(1) + ' M'

  return c.json({
    activeMembers: activeMembers.toString(),
    totalSavings: formatRp(totalSavings),
    totalLoans: formatRp(totalLoans),
    npl: nplValue,
    roleData,
    purposeData,
    monthlyData,
    recentActivities
  })
})

const loginAttempts = new Map<string, { count: number, resetAt: number }>();

const cleanupAttempts = () => {
  const now = Date.now();
  for (const [ip, attempt] of loginAttempts.entries()) {
    if (now > attempt.resetAt) {
      loginAttempts.delete(ip);
    }
  }
};

// Cleanup expired login attempts to prevent memory leaks
const cleanupInterval = setInterval(cleanupAttempts, 15 * 60 * 1000); // run every 15 minutes
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

export const _test = {
  loginAttempts,
  cleanupAttempts,
  tokenBlacklist,
  cleanupTokenBlacklist
};

function rateLimitLogin(ip: string): boolean {
  const now = Date.now();
  const limit = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes

  let attempt = loginAttempts.get(ip);
  if (!attempt) {
    attempt = { count: 0, resetAt: now + windowMs };
    loginAttempts.set(ip, attempt);
  }

  if (now > attempt.resetAt) {
    attempt.count = 1;
    attempt.resetAt = now + windowMs;
    return true;
  }

  attempt.count++;
  if (attempt.count > limit) {
    return false;
  }

  return true;
}

// Login authentication
app.post('/api/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown-ip';
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
      exp: Math.floor(Date.now() / 1000) + 15 * 60 // 15 minutes
    }
    const accessToken = await sign(payload, secretKey)

    const refreshPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
    }
    const refreshToken = await sign(refreshPayload, secretKey)

    setCookie(c, 'refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/'
    })

    return c.json({ success: true, message: 'Login successful', token: accessToken, role: admin.role })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Refresh endpoint
app.post('/api/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refreshToken')
  if (!refreshToken) {
    return c.json({ success: false, message: 'No refresh token' }, 401)
  }
  try {
    const payload = await verify(refreshToken, secretKey)
    const newPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + 15 * 60 }
    const newAccessToken = await sign(newPayload, secretKey)
    return c.json({ success: true, token: newAccessToken })
  } catch (err) {
    return c.json({ success: false, message: 'Invalid or expired refresh token' }, 401)
  }
})

// Logout endpoint
app.post('/api/logout', (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { payload } = decode(token);
      if (payload && payload.exp) {
        tokenBlacklist.set(token, (payload.exp as number) * 1000);
      } else {
        tokenBlacklist.set(token, Date.now() + 60 * 60 * 1000); // fallback 1 hour
      }
    } catch (e) {
      tokenBlacklist.set(token, Date.now() + 60 * 60 * 1000);
    }
  }
  deleteCookie(c, 'refreshToken', { path: '/' })
  return c.json({ success: true, message: 'Logout successful' })
})

// Get settings
app.get('/api/settings', (c) => {
  const settingsArray = db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
  const settingsObj: Record<string, string> = {}
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value
  }
  return c.json(settingsObj)
})

// Update settings
app.put('/api/settings', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const update = db.prepare("UPDATE settings SET value = ? WHERE key = ?")
    for (const [key, value] of Object.entries(parsed.data)) {
      update.run(String(value), key)
    }
    return c.json({ success: true })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Get SHU
app.get('/api/shu', (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  
  const bungaSetting = db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '1.5');

  const payments = db.query(`
    SELECT lp.amount as paymentAmount, l.amount as principalAmount, l.tenor
    FROM loan_payments lp
    JOIN loans l ON lp.loanId = l.id
    WHERE strftime('%Y', lp.paymentDate) = ?
  `).all(year) as any[];

  let pendapatan = 0;
  for (const p of payments) {
    const tenorMonths = parseInt(p.tenor) || 1;
    const interestAmount = Math.round(p.principalAmount * (bungaRate / 100) * tenorMonths);
    const totalAmount = p.principalAmount + interestAmount;
    const interestPaid = totalAmount > 0 ? Math.round(p.paymentAmount * (interestAmount / totalAmount)) : 0;
    pendapatan += interestPaid;
  }
  
  const biayaOperasional = Math.round(pendapatan * 0.2); // Asumsi biaya ops 20%
  const shuNetto = Math.max(0, pendapatan - biayaOperasional);
  
  const distribusi = {
    anggota: Math.round(shuNetto * 0.40),
    cadangan: Math.round(shuNetto * 0.25),
    pengurus: Math.round(shuNetto * 0.20),
    sosial: Math.round(shuNetto * 0.10),
    pembangunan: Math.round(shuNetto * 0.05),
  };
  
  const members = db.query("SELECT id, name, totalSavings FROM members").all() as any[];
  const totalSimpananSeluruhAnggota = members.reduce((sum, m) => sum + m.totalSavings, 0);
  
  const alokasiAnggota = members.map(m => {
    const porsi = totalSimpananSeluruhAnggota > 0 ? m.totalSavings / totalSimpananSeluruhAnggota : 0;
    return {
      id: m.id,
      name: m.name,
      totalSavings: m.totalSavings,
      shu: Math.round(distribusi.anggota * porsi)
    };
  }).sort((a, b) => b.shu - a.shu);
  
  return c.json({
    year,
    pendapatan,
    biayaOperasional,
    shuNetto,
    distribusi,
    alokasiAnggota
  });
});

// Verify token
app.get('/api/auth/verify', (c) => {
  return c.json({ success: true, message: 'Token is valid' })
})

console.log('Hono server running on http://localhost:3000')

export default {
  port: 3000,
  fetch: app.fetch,
}


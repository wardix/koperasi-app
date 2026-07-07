import type { MemberRow, LoanRow, DashboardData, SettingsData } from "../shared/types";
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import db from './db'
import { z } from 'zod'

const app = new Hono()

const allowedOrigins = (process.env.CORS_ORIGIN || Bun.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

// Use CORS middleware to allow requests from Vite
app.use('/*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

const JWT_SECRET = process.env.JWT_SECRET || Bun.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' || Bun.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set in production');
  }
  console.warn('WARNING: Using default JWT_SECRET for development. Do not use in production!');
}

export const secretKey = JWT_SECRET || 'koperasi-super-secret-key-2026';

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/login' || c.req.path === '/api/logout') {
    return next()
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
  name: z.string().min(1, "Name is required"),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required"),
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
  memberId: z.string().min(1, "Member ID is required"),
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive(),
  tenor: z.string().min(1, "Tenor is required"),
  purpose: z.string().min(1, "Purpose is required"),
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]).default("Menunggu")
})

const loanStatusSchema = z.object({
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string().min(1)
})

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

const settingsSchema = z.record(z.union([z.string(), z.boolean(), z.number()]))

// Get all members
app.get('/api/members', (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
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
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = (page - 1) * limit

  const loans = db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount 
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    GROUP BY l.id
    ORDER BY l.rowid DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset)
  const totalRes = db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number }

  return c.json({
    data: loans,
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
    const loan = db.query("SELECT amount FROM loans WHERE id = ?").get(loanId) as { amount: number };
    if (!loan) return c.json({ success: false, message: 'Loan not found' }, 404);
    
    const paid = (db.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get(loanId) as any).paid || 0;
    
    if (paid + amount > loan.amount) {
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
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
    }
    const token = await sign(payload, secretKey)
    return c.json({ success: true, message: 'Login successful', token, role: admin.role })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Logout endpoint
app.post('/api/logout', (c) => {
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

// Verify token
app.get('/api/auth/verify', (c) => {
  return c.json({ success: true, message: 'Token is valid' })
})

console.log('Hono server running on http://localhost:3000')

export default {
  port: 3000,
  fetch: app.fetch,
}


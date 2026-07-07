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

const secretKey = JWT_SECRET || 'koperasi-super-secret-key-2026';

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

// Zod schemas
const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["Anggota", "Ketua", "Bendahara", "Sekretaris"]),
  status: z.enum(["Aktif", "Pasif"]),
  joinDate: z.string().min(1, "Join date is required"),
  totalSavings: z.number().nonnegative(),
})

const savingsSchema = z.object({
  additionalSavings: z.union([
    z.number().nonnegative(),
    z.string().regex(/^\d+$/).transform(val => parseInt(val, 10))
  ])
})

const loanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.number().positive(),
  tenor: z.string().min(1, "Tenor is required"),
  purpose: z.string().min(1, "Purpose is required"),
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

const loanStatusSchema = z.object({
  status: z.enum(["Menunggu", "Disetujui", "Ditolak", "Lunas"]),
})

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

const settingsSchema = z.record(z.union([z.string(), z.boolean(), z.number()]))

// Get all members
app.get('/api/members', (c) => {
  const members = db.query("SELECT * FROM members ORDER BY rowid DESC").all()
  return c.json(members)
})

// Delete a member
app.delete('/api/members/:id', (c) => {
  const id = c.req.param('id')
  db.query("DELETE FROM members WHERE id = ?").run(id)
  return c.json({ success: true })
})

// Create a new member
app.post('/api/members', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate, totalSavings } = parsed.data
    const id = crypto.randomUUID()

    const insert = db.prepare(`
      INSERT INTO members (id, name, role, status, joinDate, totalSavings)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    insert.run(id, name, role, status, joinDate, totalSavings)
    
    return c.json({ success: true, message: 'Member created successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Update member savings
app.put('/api/members/:id/savings', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = savingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { additionalSavings } = parsed.data

    // get current
    const member = db.query("SELECT totalSavings FROM members WHERE id = ?").get(id) as {totalSavings: number}
    if (!member) return c.json({success: false, message: 'Not found'}, 404)

    const current = member.totalSavings
    const newTotal = current + additionalSavings

    db.query("UPDATE members SET totalSavings = ? WHERE id = ?").run(newTotal, id)
    
    return c.json({ success: true, newTotal })
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Get all loans
app.get('/api/loans', (c) => {
  const loans = db.query("SELECT * FROM loans ORDER BY rowid DESC").all()
  return c.json(loans)
})

// Create a new loan
app.post('/api/loans', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loanSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, amount, tenor, purpose, status } = parsed.data
    const id = crypto.randomUUID()

    const insert = db.prepare(`
      INSERT INTO loans (id, name, amount, tenor, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    
    insert.run(id, name, amount, tenor, purpose, status)
    
    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (error) {
    return c.json({ success: false, message: 'Invalid request' }, 400)
  }
})

// Update loan status
app.put('/api/loans/:id/status', async (c) => {
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

// Get dashboard stats
app.get('/api/stats', (c) => {
  const members = db.query("SELECT * FROM members").all() as any[]
  const loans = db.query("SELECT * FROM loans").all() as any[]
  
  const activeMembers = members.filter(m => m.status === 'Aktif').length
  
  const totalSavings = members.reduce((sum, m) => sum + m.totalSavings, 0)
  const totalLoans = loans.filter(l => l.status === 'Disetujui').reduce((sum, l) => sum + l.amount, 0)
  
  const formatRp = (val: number) => 'Rp ' + (val / 1000000).toFixed(1) + ' M'
  
  // Distribusi Anggota (berdasarkan Role)
  const roleDistribution = members.reduce((acc: any, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1
    return acc
  }, {})
  const roleData = Object.keys(roleDistribution).map((role, i) => ({
    label: role,
    value: roleDistribution[role],
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  // Distribusi Pinjaman (berdasarkan Purpose)
  const loanDistribution = loans.reduce((acc: any, l) => {
    acc[l.purpose] = (acc[l.purpose] || 0) + 1
    return acc
  }, {})
  const purposeData = Object.keys(loanDistribution).map((purpose, i) => ({
    label: purpose,
    value: loanDistribution[purpose],
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  // Tren Bulanan (Mocked based on real totals to show a trend)
  const monthlyData = [
    { label: 'Jan', simpanan: totalSavings * 0.5, pinjaman: totalLoans * 0.3 },
    { label: 'Feb', simpanan: totalSavings * 0.6, pinjaman: totalLoans * 0.4 },
    { label: 'Mar', simpanan: totalSavings * 0.7, pinjaman: totalLoans * 0.5 },
    { label: 'Apr', simpanan: totalSavings * 0.8, pinjaman: totalLoans * 0.6 },
    { label: 'May', simpanan: totalSavings * 0.9, pinjaman: totalLoans * 0.8 },
    { label: 'Jun', simpanan: totalSavings, pinjaman: totalLoans },
  ]
  
  const recentMembers = members.slice(-5).map(m => ({
    id: m.id,
    activity: 'Anggota Baru',
    name: m.name,
    amount: m.totalSavings,
    date: m.joinDate,
  }))

  const recentLoans = loans.slice(-5).map(l => ({
    id: l.id,
    activity: 'Pengajuan Pinjaman',
    name: l.name,
    amount: l.amount,
    date: new Date().toISOString().split('T')[0],
  }))
  
  const recentActivities = [...recentMembers, ...recentLoans].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5)

  return c.json({
    activeMembers: activeMembers.toLocaleString('id-ID'),
    totalSavings: formatRp(totalSavings),
    totalLoans: formatRp(totalLoans),
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
    
    const admin = db.query("SELECT * FROM admins WHERE email = ?").get(email) as {password: string, email: string} | undefined
    
    if (admin) {
      const isMatch = await Bun.password.verify(password, admin.password)
      if (isMatch) {
        const payload = {
          email: admin.email,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
        }
        const token = await sign(payload, secretKey)
        return c.json({ success: true, message: 'Login successful', token })
      }
    }
    
    return c.json({ success: false, message: 'Invalid credentials' }, 401)
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
app.put('/api/settings', async (c) => {
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


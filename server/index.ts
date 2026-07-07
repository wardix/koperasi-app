import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import db from './db'
import { z } from 'zod'

const app = new Hono()

// Use CORS middleware to allow requests from Vite
app.use('/*', cors({
  origin: 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

const JWT_SECRET = 'koperasi-super-secret-key-2026'

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/login' || c.req.path === '/api/logout') {
    return next()
  }
  const jwtMiddleware = jwt({
    secret: JWT_SECRET,
    alg: 'HS256',
  })
  return jwtMiddleware(c, next)
})

// Zod schemas
const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  status: z.string().min(1, "Status is required"),
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
  status: z.string().min(1, "Status is required"),
})

const loanStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
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
  
  return c.json({
    activeMembers: activeMembers.toLocaleString('id-ID'),
    totalSavings: formatRp(totalSavings),
    totalLoans: formatRp(totalLoans)
  })
})

// Login authentication
app.post('/api/login', async (c) => {
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
        const token = await sign(payload, JWT_SECRET)
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

console.log('Hono server running on http://localhost:3000')

export default {
  port: 3000,
  fetch: app.fetch,
}

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import db from './db'

const app = new Hono()

// Use CORS middleware to allow requests from Vite
app.use('/*', cors({
  origin: 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
}))

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
  const body = await c.req.json()
  const { id, name, role, status, joinDate, totalSavings } = body

  const insert = db.prepare(`
    INSERT INTO members (id, name, role, status, joinDate, totalSavings)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  insert.run(id, name, role, status, joinDate, totalSavings)
  
  return c.json({ success: true, message: 'Member created successfully' }, 201)
})

// Update member savings
app.put('/api/members/:id/savings', async (c) => {
  const id = c.req.param('id')
  const { additionalSavings } = await c.req.json()

  // get current
  const member = db.query("SELECT totalSavings FROM members WHERE id = ?").get(id) as {totalSavings: number}
  if (!member) return c.json({success: false, message: 'Not found'}, 404)

  const current = member.totalSavings
  const addition = typeof additionalSavings === 'string' ? parseInt(additionalSavings.replace(/\D/g, ''), 10) || 0 : additionalSavings
  const newTotal = current + addition

  db.query("UPDATE members SET totalSavings = ? WHERE id = ?").run(newTotal, id)
  
  return c.json({ success: true, newTotal })
})

// Get all loans
app.get('/api/loans', (c) => {
  const loans = db.query("SELECT * FROM loans ORDER BY rowid DESC").all()
  return c.json(loans)
})

// Create a new loan
app.post('/api/loans', async (c) => {
  const body = await c.req.json()
  const { id, name, amount, tenor, purpose, status } = body

  const insert = db.prepare(`
    INSERT INTO loans (id, name, amount, tenor, purpose, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  
  insert.run(id, name, amount, tenor, purpose, status)
  
  return c.json({ success: true, message: 'Loan created successfully' }, 201)
})

// Update loan status
app.put('/api/loans/:id/status', async (c) => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  
  const update = db.prepare(`
    UPDATE loans SET status = ? WHERE id = ?
  `)
  update.run(status, id)
  
  return c.json({ success: true, message: 'Loan status updated' })
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
  const { email, password } = await c.req.json()
  
  const admin = db.query("SELECT * FROM admins WHERE email = ? AND password = ?").get(email, password)
  
  if (admin) {
    return c.json({ success: true, message: 'Login successful' })
  } else {
    return c.json({ success: false, message: 'Invalid credentials' }, 401)
  }
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
  const body = await c.req.json()
  const update = db.prepare("UPDATE settings SET value = ? WHERE key = ?")
  for (const [key, value] of Object.entries(body)) {
    update.run(String(value), key)
  }
  return c.json({ success: true })
})

console.log('Hono server running on http://localhost:3000')

export default {
  port: 3000,
  fetch: app.fetch,
}

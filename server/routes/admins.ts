import { Hono } from 'hono'
import db from '../db'
import { adminCreationSchema, adminUpdateSchema } from '../schemas'
import { requirePermission } from '../middleware'

const admins = new Hono()

// Apply requirePermission('manage:users') to all routes in this router
admins.use('*', requirePermission('manage:users'))

// GET /api/v1/admins
admins.get('/', async (c) => {
  const rows = await db.query(
    "SELECT id, email, role, google_id, name, avatar_url, auth_provider FROM admins ORDER BY email ASC"
  ).all() as any[]
  
  return c.json({ success: true, data: rows })
})

// POST /api/v1/admins
admins.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const parsed = adminCreationSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { email, password, role, name } = parsed.data
    
    // Check if email already exists
    const existing = await db.query("SELECT 1 FROM admins WHERE email = ?").get(email)
    if (existing) {
      return c.json({ success: false, message: 'Email pengurus sudah terdaftar' }, 400)
    }
    
    const id = crypto.randomUUID()
    let hashedPassword = ""
    let authProvider = "google" // If no password provided, it defaults to SSO
    
    if (password) {
      hashedPassword = await Bun.password.hash(password)
      authProvider = "local"
    }
    
    const stmt = await db.prepare(`
      INSERT INTO admins (id, email, password, role, name, auth_provider)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    await stmt.run(id, email, hashedPassword, role, name || null, authProvider)
    
    return c.json({ success: true, message: 'Pengurus berhasil ditambahkan', id }, 201)
  } catch (error) {
    throw error
  }
})

// PUT /api/v1/admins/:id
admins.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = adminUpdateSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }
    
    const { role } = parsed.data
    const currentUserPayload = c.get('jwtPayload')
    
    // Prevent self-role modification to avoid locking oneself out of superadmin
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat mengubah peran Anda sendiri' }, 400)
    }
    
    const stmt = await db.prepare("UPDATE admins SET role = ? WHERE id = ?")
    await stmt.run(role, id)
    
    return c.json({ success: true, message: 'Peran pengurus berhasil diperbarui' })
  } catch (error) {
    throw error
  }
})

// DELETE /api/v1/admins/:id
admins.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const currentUserPayload = c.get('jwtPayload')
    
    // Prevent self-deletion
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri' }, 400)
    }
    
    const stmt = await db.prepare("DELETE FROM admins WHERE id = ?")
    await stmt.run(id)
    
    return c.json({ success: true, message: 'Pengurus berhasil dihapus' })
  } catch (error) {
    throw error
  }
})

export default admins

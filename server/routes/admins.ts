import { Hono } from 'hono'
import db from '../db'
import type { AdminPublic, MemberRow } from '../db/entities'
import { adminCreationSchema, adminUpdateSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { audit, getActor, getClientIp, getJwtPayload } from '../lib/audit'

const admins = new Hono()

// Apply requirePermission('manage:users') to all routes in this router
admins.use('*', requirePermission('manage:users'))

/**
 * Reconciliation response type for savings balance drift detection
 */
interface SavingsReconciliationResult {
  memberId: string
  memberName: string
  dbTotalSavings: number
  calculatedTotal: number
  difference: number
  simpananPokok: number
  simpananWajib: number
  simpananSukarela: number
}

// GET /api/v1/admins
admins.get('/', async (c) => {
  const rows = await db.query(
    "SELECT id, email, role, google_id, name, avatar_url, auth_provider FROM admins ORDER BY email ASC"
  ).all<AdminPublic>()

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

    // Audit: log admin creation
    await audit(db, {
      actor: getActor(c),
      action: 'create_admin',
      entity: 'admins',
      entityId: id,
      after: { email, role, name },
      ip: getClientIp(c),
    })

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
    const currentUserPayload = getJwtPayload(c)
    
    // Prevent self-role modification to avoid locking oneself out of superadmin
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat mengubah peran Anda sendiri' }, 400)
    }
    
    const stmt = await db.prepare("UPDATE admins SET role = ? WHERE id = ?")
    await stmt.run(role, id)

    // Audit: log admin role update
    const before = await db.query("SELECT email, role FROM admins WHERE id = ?").get<Pick<AdminPublic, "email" | "role">>(id)
    await audit(db, {
      actor: getActor(c),
      action: 'update_admin',
      entity: 'admins',
      entityId: id,
      before: before ? { role: before.role } : undefined,
      after: { role },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Peran pengurus berhasil diperbarui' })
  } catch (error) {
    throw error
  }
})

// DELETE /api/v1/admins/:id
admins.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const currentUserPayload = getJwtPayload(c)

    // Prevent self-deletion
    if (currentUserPayload && currentUserPayload.sub === id) {
      return c.json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri' }, 400)
    }

    // Capture before state for audit (fetch email/role before delete)
    const before = await db.query("SELECT email, role FROM admins WHERE id = ?").get<Pick<AdminPublic, "email" | "role">>(id)

    const stmt = await db.prepare("DELETE FROM admins WHERE id = ?")
    await stmt.run(id)

    // Audit: log admin deletion
    if (before) {
      await audit(db, {
        actor: getActor(c),
        action: 'delete_admin',
        entity: 'admins',
        entityId: id,
        before: { email: before.email, role: before.role },
        ip: getClientIp(c),
      })
    }

    return c.json({ success: true, message: 'Pengurus berhasil dihapus' })
  } catch (error) {
    throw error
  }
})

// GET /api/v1/admins/reconcile-savings - Admin endpoint to detect savings balance drift
admins.get('/reconcile-savings', async (c) => {
  try {
    // Find members where totalSavings doesn't match the sum of components
    const driftedMembers = await db.query(`
      SELECT
        id,
        name as memberName,
        simpananPokok,
        simpananWajib,
        simpananSukarela,
        totalSavings as dbTotalSavings,
        (simpananPokok + simpananWajib + simpananSukarela) as calculatedTotal
      FROM members
      WHERE totalSavings != simpananPokok + simpananWajib + simpananSukarela
    `).all<{
      id: string
      memberName: string
      simpananPokok: number
      simpananWajib: number
      simpananSukarela: number
      dbTotalSavings: number
      calculatedTotal: number
    }>()

    // Calculate the difference for each drifted member
    const reconciliationResults: SavingsReconciliationResult[] = driftedMembers.map(m => ({
      memberId: m.id,
      memberName: m.memberName,
      dbTotalSavings: Number(m.dbTotalSavings) || 0,
      calculatedTotal: Number(m.simpananPokok) + Number(m.simpananWajib) + Number(m.simpananSukarela),
      difference: (Number(m.dbTotalSavings) || 0) - (Number(m.simpananPokok) + Number(m.simpananWajib) + Number(m.simpananSukarela)),
      simpananPokok: Number(m.simpananPokok) || 0,
      simpananWajib: Number(m.simpananWajib) || 0,
      simpananSukarela: Number(m.simpananSukarela) || 0
    }))

    // Also check for negative balances (which violate CHECK constraint after migration)
    const negativeBalanceMembers = await db.query(`
      SELECT
        id,
        name as memberName,
        simpananPokok,
        simpananWajib,
        simpananSukarela,
        totalSavings
      FROM members
      WHERE simpananPokok < 0 OR simpananWajib < 0 OR simpananSukarela < 0 OR totalSavings < 0
    `).all<{
      id: string
      memberName: string
      simpananPokok: number
      simpananWajib: number
      simpananSukarela: number
      totalSavings: number
    }>()

    return c.json({
      success: true,
      data: {
        reconciliationResults,
        negativeBalanceMembers,
        summary: {
          totalDrifted: reconciliationResults.length,
          totalNegativeBalances: negativeBalanceMembers.length,
          totalIssues: reconciliationResults.length + negativeBalanceMembers.length
        }
      }
    })
  } catch (error) {
    throw error
  }
})

// POST /api/v1/admins/reconcile-savings - Admin endpoint to fix savings balance drift
admins.post('/reconcile-savings', async (c) => {
  try {
    const { memberId } = await c.req.json()

    if (!memberId) {
      return c.json({ success: false, message: 'memberId is required' }, 400)
    }

    // Get current member data
    const member = await db.query(`
      SELECT id, name, simpananPokok, simpananWajib, simpananSukarela, totalSavings
      FROM members WHERE id = ?
    `).get<Pick<MemberRow, 'id' | 'name' | 'simpananPokok' | 'simpananWajib' | 'simpananSukarela' | 'totalSavings'>>(memberId)

    if (!member) {
      return c.json({ success: false, message: 'Member not found' }, 404)
    }

    // Calculate correct total
    const correctTotal = Number(member.simpananPokok) + Number(member.simpananWajib) + Number(member.simpananSukarela)

    // Update the member with corrected total
    await db.query("UPDATE members SET totalSavings = ? WHERE id = ?").run(correctTotal, memberId)

    // Audit: log savings reconciliation
    await audit(db, {
      actor: getActor(c),
      action: 'update_savings',
      entity: 'members',
      entityId: memberId,
      before: { totalSavings: Number(member.totalSavings) },
      after: { totalSavings: correctTotal, reconciledBy: getActor(c) },
      ip: getClientIp(c),
    })

    return c.json({
      success: true,
      message: `Balance reconciled for ${member.name}`,
      data: {
        memberId: member.id,
        previousTotal: Number(member.totalSavings),
        correctedTotal: correctTotal
      }
    })
  } catch (error) {
    throw error
  }
})

export default admins

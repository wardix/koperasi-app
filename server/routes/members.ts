import { Hono } from 'hono'
import db from '../db'
import { memberSchema, savingsSchema } from '../schemas'
import { requireAdmin } from '../middleware'
import { parsePagination } from '../services/pagination'
import { clearStatsCache } from './stats'

const members = new Hono()

members.get('/', async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  
  const rows = await db.query("SELECT * FROM members ORDER BY id DESC LIMIT ? OFFSET ?").all(limit, offset)
  const totalRes = await db.query("SELECT COUNT(*) as count FROM members").get() as { count: number }
  
  return c.json({
    success: true,
    data: {
      data: rows,
      total: totalRes.count,
      page,
      limit
    }
  })
})

members.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id')
  try {
    await db.query("DELETE FROM members WHERE id = ?").run(id)
    clearStatsCache()
    return c.json({ success: true })
  } catch (err: any) {
    if (err.message && err.message.includes("FOREIGN KEY constraint failed")) {
      return c.json({ success: false, message: 'Anggota memiliki pinjaman, hapus pinjaman terlebih dahulu.' }, 400)
    }
    return c.json({ success: false, message: 'Gagal menghapus anggota' }, 500)
  }
})

members.post('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela } = parsed.data
    const totalSavings = simpananPokok + simpananWajib + simpananSukarela
    const id = crypto.randomUUID()

    const insert = await db.prepare(`
      INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    await insert.run(id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Member created successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

members.put('/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela } = parsed.data
    const totalSavings = simpananPokok + simpananWajib + simpananSukarela

    const update = await db.prepare(`
      UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?, simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ?
      WHERE id = ?
    `)
    await update.run(name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings, id)
    clearStatsCache()
    
    return c.json({ success: true, message: 'Member updated successfully' })
  } catch (error) {
    throw error
  }
})

members.put('/:id/savings', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = savingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { additionalSavings, savingsType } = parsed.data

    const member = await db.query("SELECT simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?").get(id) as {simpananPokok: number, simpananWajib: number, simpananSukarela: number, totalSavings: number}
    if (!member) return c.json({success: false, message: 'Not found'}, 404)

    const additionalSavingsNum = Number(additionalSavings)
    let newPokok = member.simpananPokok ?? member.simpananpokok ?? 0
    let newWajib = member.simpananWajib ?? member.simpananwajib ?? 0
    let newSukarela = member.simpananSukarela ?? member.simpanansukarela ?? 0
    
    if (savingsType === 'pokok') newPokok += additionalSavingsNum
    else if (savingsType === 'wajib') newWajib += additionalSavingsNum
    else newSukarela += additionalSavingsNum
    
    if (newPokok < 0 || newWajib < 0 || newSukarela < 0) {
      return c.json({ success: false, message: "Saldo tidak mencukupi" }, 400)
    }
    
    const newTotal = newPokok + newWajib + newSukarela

    await db.transaction(async () => {
      await db.query("UPDATE members SET simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ? WHERE id = ?").run(newPokok, newWajib, newSukarela, newTotal, id)
      await db.query(`
        INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        additionalSavingsNum >= 0 ? `setor_${savingsType}` : `tarik_${savingsType}`,
        Math.abs(additionalSavingsNum),
        member.totalSavings ?? member.totalsavings ?? 0,
        newTotal,
        new Date().toISOString(),
        (c.get('jwtPayload') as any)?.email || 'admin'
      )
    })()
    clearStatsCache()
    
    return c.json({ success: true, data: { newTotal } })
  } catch (error) {
    throw error
  }
})

members.get('/:id/transactions', async (c) => {
  const id = c.req.param('id')
  const rows = await db.query("SELECT * FROM transactions WHERE memberId = ? ORDER BY createdAt DESC").all(id)
  return c.json({ success: true, data: rows })
})

export default members

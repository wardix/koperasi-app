import { Hono } from 'hono'
import db from '../db'
import { memberSchema, savingsSchema } from '../schemas'
import { requireAdmin } from '../middleware'
import { parsePagination } from '../services/pagination'
import { clearStatsCache } from './stats'

const members = new Hono()

members.get('/', (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  
  const rows = db.query("SELECT * FROM members ORDER BY rowid DESC LIMIT ? OFFSET ?").all(limit, offset)
  const totalRes = db.query("SELECT COUNT(*) as count FROM members").get() as { count: number }
  
  return c.json({
    data: rows,
    total: totalRes.count,
    page,
    limit
  })
})

members.delete('/:id', requireAdmin, (c) => {
  const id = c.req.param('id')
  try {
    db.query("DELETE FROM members WHERE id = ?").run(id)
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

    const insert = db.prepare(`
      INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    insert.run(id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
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

    const update = db.prepare(`
      UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?, simpananPokok = ?, simpananWajib = ?, simpananSukarela = ?, totalSavings = ?
      WHERE id = ?
    `)
    update.run(name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings, id)
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
        (c.get('jwtPayload') as any)?.email || 'admin'
      )
    })()
    clearStatsCache()
    
    return c.json({ success: true, newTotal })
  } catch (error) {
    throw error
  }
})

members.get('/:id/transactions', (c) => {
  const id = c.req.param('id')
  const rows = db.query("SELECT * FROM transactions WHERE memberId = ? ORDER BY createdAt DESC").all(id)
  return c.json(rows)
})

export default members

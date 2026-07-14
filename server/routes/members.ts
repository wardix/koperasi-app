import { Hono } from 'hono'
import db from '../db'
import { memberSchema, savingsSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'

const members = new Hono()

members.get('/', requirePermission('read:members'), async (c) => {
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

members.delete('/:id', requirePermission('delete:members'), async (c) => {
  const id = c.req.param('id')

  // Capture before state for audit (fetch name/role before delete)
  const before = await db.query("SELECT name, role FROM members WHERE id = ?").get(id) as any

  try {
    await db.query("DELETE FROM members WHERE id = ?").run(id)

    // Audit: log member deletion
    if (before) {
      await audit(db, {
        actor: getActor(c),
        action: 'delete_member',
        entity: 'members',
        entityId: id,
        before: { name: before.name, role: before.role },
        ip: getClientIp(c),
      })
    }

    clearStatsCache()
    return c.json({ success: true })
  } catch (err: any) {
    if (err.message && err.message.includes("FOREIGN KEY constraint failed")) {
      return c.json({ success: false, message: 'Anggota memiliki pinjaman, hapus pinjaman terlebih dahulu.' }, 400)
    }
    return c.json({ success: false, message: 'Gagal menghapus anggota' }, 500)
  }
})

members.post('/', requirePermission('create:members'), async (c) => {
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

    await db.transaction(async () => {
      await insert.run(id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)

      if (simpananPokok > 0) {
        await db.query(`
          INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          'setor_pokok',
          simpananPokok,
          0,
          simpananPokok,
          new Date().toISOString(),
          (c.get('jwtPayload') as any)?.email || 'admin'
        )
      }
      if (simpananWajib > 0) {
        await db.query(`
          INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          'setor_wajib',
          simpananWajib,
          simpananPokok,
          simpananPokok + simpananWajib,
          new Date().toISOString(),
          (c.get('jwtPayload') as any)?.email || 'admin'
        )
      }
      if (simpananSukarela > 0) {
        const balBefore = simpananPokok + simpananWajib
        await db.query(`
          INSERT INTO transactions (id, memberId, type, amount, balanceBefore, balanceAfter, createdAt, createdBy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          'setor_sukarela',
          simpananSukarela,
          balBefore,
          balBefore + simpananSukarela,
          new Date().toISOString(),
          (c.get('jwtPayload') as any)?.email || 'admin'
        )
      }
    })()

    // Audit: log member creation
    await audit(db, {
      actor: getActor(c),
      action: 'create_member',
      entity: 'members',
      entityId: id,
      after: { name, role, status, joinDate },
      ip: getClientIp(c),
    })

    clearStatsCache()

    return c.json({ success: true, message: 'Member created successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

members.put('/:id', requirePermission('update:members'), async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const parsed = memberSchema.safeParse(body)
    
    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { name, role, status, joinDate } = parsed.data

    const oldMember = await db.query("SELECT id, name, role, status, joinDate FROM members WHERE id = ?").get(id) as any
    if (!oldMember) return c.json({success: false, message: 'Member not found'}, 404)

    const update = await db.prepare(`
      UPDATE members SET name = ?, role = ?, status = ?, joinDate = ?
      WHERE id = ?
    `)
    await update.run(name, role, status, joinDate, id)

    // Audit: log member update
    await audit(db, {
      actor: getActor(c),
      action: 'update_member',
      entity: 'members',
      entityId: id,
      before: oldMember ? { name: oldMember.name, role: oldMember.role } : undefined,
      after: { name, role },
      ip: getClientIp(c),
    })

    clearStatsCache()

    return c.json({ success: true, message: 'Member updated successfully' })
  } catch (error) {
    throw error
  }
})

members.put('/:id/savings', requirePermission('update:savings'), async (c) => {
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

    // Withdrawal guard: check if withdrawal exceeds available voluntary savings (sukarela)
    // Simpanan pokok dan wajib bersifat terikat, hanya simpanan sukarela yang bisa ditarik
    if (additionalSavingsNum < 0) {
      const withdrawalAmount = Math.abs(additionalSavingsNum)

      // For withdraw operations, check against available sukarela balance
      // This ensures we don't overdraw from the voluntary savings pool
      if (newSukarela < 0) {
        return c.json({ success: false, message: "Penarikan melebihi saldo sukarela tersedia" }, 400)
      }

      // Additional guard: totalSavings must remain non-negative after withdrawal
      const newTotal = newPokok + newWajib + newSukarela
      if (newTotal < 0) {
        return c.json({ success: false, message: "Penarikan melebihi total simpanan tersedia" }, 400)
      }
    }

    // Check for negative balances after all operations
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

    // Audit: log savings update
    await audit(db, {
      actor: getActor(c),
      action: 'update_savings',
      entity: 'members',
      entityId: id,
      before: { simpananPokok: member.simpananPokok, simpananWajib: member.simpananWajib, simpananSukarela: member.simpananSukarela },
      after: { simpananPokok: newPokok, simpananWajib: newWajib, simpananSukarela: newSukarela, additionalSavings: additionalSavingsNum, savingsType },
      ip: getClientIp(c),
    })

    clearStatsCache()

    return c.json({ success: true, data: { newTotal } })
  } catch (error) {
    throw error
  }
})

members.get('/:id/transactions', requirePermission('read:members'), async (c) => {
  const id = c.req.param('id')
  const rows = await db.query("SELECT * FROM transactions WHERE memberId = ? ORDER BY createdAt DESC").all(id)
  return c.json({ success: true, data: rows })
})

export default members

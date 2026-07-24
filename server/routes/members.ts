import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import db from '../db'
import type { MemberRow, TransactionRow } from '../db/entities'
import {
  memberCreateSchema,
  memberPortalAccessSchema,
  memberSchema,
  savingsSchema,
} from '../schemas'
import { requirePermission, secretKey } from '../middleware'
import { parsePagination } from '../services/pagination'
import { createMember, deleteMember, setMemberPortalAccess, updateMember } from '../services/memberService'
import { updateMemberSavings } from '../services/savingsService'
import { mapServiceError, requireRouteParam } from '../lib/serviceResponse'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'

const members = new Hono()

members.get('/', requirePermission('read:members'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit
  const includeArchived = c.req.query('includeArchived') === 'true'

  const whereClause = includeArchived ? '' : 'WHERE deletedAt IS NULL'

  // Never return password hashes to the client
  const rows = await db.query(`
    SELECT
      id, name, role, status, joinDate, nik, phone,
      simpananPokok, simpananWajib, simpananSukarela, totalSavings,
      email,
      CASE WHEN password IS NOT NULL AND password <> '' THEN TRUE ELSE FALSE END AS "hasPortalAccess"
    FROM members
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `).all<MemberRow>(limit, offset)
  const totalRes = await db.query(`SELECT COUNT(*) as count FROM members ${whereClause}`).get<{ count: number }>()

  return c.json({
    success: true,
    data: {
      data: rows,
      total: totalRes?.count ?? 0,
      page,
      limit
    }
  })
})

members.delete('/:id', requirePermission('delete:members'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const before = await deleteMember(db, id)

    await audit(db, {
      actor: getActor(c),
      action: 'archive_member',
      entity: 'members',
      entityId: id,
      before: { name: before.name, role: before.role },
      after: { deletedAt: new Date().toISOString() },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Member archived successfully' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

members.post('/', requirePermission('create:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberCreateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const { id, hasPortalAccess } = await createMember(db, parsed.data, getActor(c))

    await audit(db, {
      actor: getActor(c),
      action: 'create_member',
      entity: 'members',
      entityId: id,
      after: {
        name: parsed.data.name,
        role: parsed.data.role,
        status: parsed.data.status,
        joinDate: parsed.data.joinDate,
        nik: parsed.data.nik ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        hasPortalAccess,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({
      success: true,
      message: hasPortalAccess
        ? 'Anggota berhasil ditambahkan dan akses portal diaktifkan'
        : 'Member created successfully',
      id,
      data: { id, hasPortalAccess, email: parsed.data.email ?? null },
    }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

members.put('/:id', requirePermission('update:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const { before } = await updateMember(db, id, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'update_member',
      entity: 'members',
      entityId: id,
      before,
      after: {
        name: parsed.data.name,
        role: parsed.data.role,
        nik: parsed.data.nik ?? null,
        phone: parsed.data.phone ?? null,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Member updated successfully' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

/**
 * Admin impersonation: short-lived member JWT to preview /portal as that member.
 * Does not require the member to have portal password set.
 */
members.post('/:id/impersonate', requirePermission('read:members'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const member = await db
      .query(
        `SELECT id, name, email, status FROM members WHERE id = ? AND deletedAt IS NULL`
      )
      .get<{ id: string; name: string; email: string | null; status: string }>(id)

    if (!member) {
      return c.json({ success: false, message: 'Anggota tidak ditemukan' }, 404)
    }

    const actor = getActor(c)
    const expSec = 15 * 60
    const payload = {
      sub: member.id,
      email: member.email || member.id,
      role: 'member',
      name: member.name,
      impersonatedBy: actor,
      preview: true,
      exp: Math.floor(Date.now() / 1000) + expSec,
    }
    const token = await sign(payload, secretKey)

    await audit(db, {
      actor,
      action: 'update_member',
      entity: 'members',
      entityId: id,
      after: { impersonationPreview: true, memberName: member.name },
      ip: getClientIp(c),
    })

    return c.json({
      success: true,
      data: {
        token,
        memberId: member.id,
        memberName: member.name,
        expiresIn: expSec,
      },
    })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

/** Set email + password for member self-service portal (/portal) */
members.put('/:id/portal-access', requirePermission('update:members'), async (c) => {
  const body = await c.req.json()
  const parsed = memberPortalAccessSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const { before, after } = await setMemberPortalAccess(db, id, {
      email: parsed.data.email,
      password: parsed.data.password,
    })

    await audit(db, {
      actor: getActor(c),
      action: 'update_member',
      entity: 'members',
      entityId: id,
      before: { email: before.email, hasPortalAccess: before.hasPassword },
      after: { email: after.email, hasPortalAccess: after.hasPassword },
      ip: getClientIp(c),
    })

    return c.json({
      success: true,
      message: 'Akses portal anggota diperbarui',
      data: { email: after.email, hasPortalAccess: after.hasPassword },
    })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

members.put('/:id/savings', requirePermission('update:savings'), async (c) => {
  const body = await c.req.json()
  const parsed = savingsSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const result = await updateMemberSavings(db, id, parsed.data, getActor(c))

    await audit(db, {
      actor: getActor(c),
      action: 'update_savings',
      entity: 'members',
      entityId: id,
      before: {
        simpananPokok: result.before.simpananPokok,
        simpananWajib: result.before.simpananWajib,
        simpananSukarela: result.before.simpananSukarela,
      },
      after: result.after,
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, data: { newTotal: result.newTotal } })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

members.get('/:id/transactions', requirePermission('read:members'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const rows = await db.query("SELECT * FROM transactions WHERE memberId = ? ORDER BY createdAt DESC")
      .all<TransactionRow>(id)
    return c.json({ success: true, data: rows })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

export default members
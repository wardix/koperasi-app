import { Hono } from 'hono'
import db from '../db'
import { requirePermission } from '../middleware'
import { z } from 'zod'
import { mapServiceError, requireRouteParam } from '../lib/serviceResponse'
import { audit, getActor, getClientIp, getJwtPayload } from '../lib/audit'
import type { AccountRow, JournalEntryRow, JournalLineRow } from '../db/entities'
import { parsePagination } from '../services/pagination'

const accounting = new Hono()

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------

accounting.get('/accounts', requirePermission('read:accounting'), async (c) => {
  const accounts = await db.query(`
    SELECT * FROM accounts 
    ORDER BY code ASC
  `).all<AccountRow>()
  
  return c.json({ success: true, data: accounts })
})

const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  normal_balance: z.enum(['DEBIT', 'CREDIT']),
})

accounting.post('/accounts', requirePermission('manage:accounting'), async (c) => {
  const body = await c.req.json()
  const parsed = accountSchema.safeParse(body)
  if (!parsed.success) return c.json({ success: false, errors: parsed.error.format() }, 400)

  try {
    const existing = await db.query(`SELECT id FROM accounts WHERE code = $1`).get(parsed.data.code)
    if (existing) {
      return c.json({ success: false, message: 'Kode akun sudah digunakan' }, 400)
    }

    const newId = crypto.randomUUID()
    await db.run(
      `INSERT INTO accounts (id, code, name, type, normal_balance) VALUES ($1, $2, $3, $4, $5)`,
      [newId, parsed.data.code, parsed.data.name, parsed.data.type, parsed.data.normal_balance]
    )

    await audit(db, {
      actor: getActor(c),
      action: 'create_account',
      entity: 'accounts',
      entityId: newId,
      after: parsed.data,
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Akun berhasil dibuat', id: newId }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------

accounting.get('/journals', requirePermission('read:accounting'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT 
      j.*,
      COALESCE(a.name, 'Sistem') as creator_name,
      (SELECT COALESCE(SUM(debit), 0) FROM journal_lines WHERE journal_entry_id = j.id) as total_amount,
      (
        SELECT json_agg(json_build_object(
          'id', l.id,
          'account_code', acc.code,
          'account_name', acc.name,
          'debit', l.debit,
          'credit', l.credit,
          'description', l.description
        ) ORDER BY l.debit DESC, acc.code ASC)
        FROM journal_lines l
        JOIN accounts acc ON l.account_id = acc.id
        WHERE l.journal_entry_id = j.id
      ) as lines
    FROM journal_entries j
    LEFT JOIN admins a ON j.created_by = a.id
    ORDER BY j.transaction_date DESC, j.created_at DESC
    LIMIT $1 OFFSET $2
  `).all<JournalEntryRow & { creator_name: string, total_amount: number, lines: any }>(limit, offset)

  const countRes = await db.query(`SELECT COUNT(*) as count FROM journal_entries`).get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: rows,
      total: Number(countRes?.count ?? 0),
      page,
      limit,
    },
  })
})

accounting.get('/journals/:id/lines', requirePermission('read:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  
  const lines = await db.query(`
    SELECT 
      l.*,
      a.code as account_code,
      a.name as account_name
    FROM journal_lines l
    JOIN accounts a ON l.account_id = a.id
    WHERE l.journal_entry_id = $1
    ORDER BY l.debit DESC, a.code ASC
  `).all<JournalLineRow & { account_code: string, account_name: string }>(id)

  return c.json({ success: true, data: lines })
})

const journalLineSchema = z.object({
  account_id: z.string().uuid(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().optional().nullable(),
})

const journalEntrySchema = z.object({
  transaction_date: z.string().min(1),
  description: z.string().min(1),
  reference_type: z.string().optional().nullable(),
  reference_id: z.string().uuid().optional().nullable(),
  lines: z.array(journalLineSchema).min(2, "Jurnal minimal harus memiliki 2 baris (Debit & Kredit)"),
})

accounting.post('/journals', requirePermission('create:accounting'), async (c) => {
  const body = await c.req.json()
  const parsed = journalEntrySchema.safeParse(body)
  if (!parsed.success) return c.json({ success: false, errors: parsed.error.format() }, 400)

  const data = parsed.data
  
  // Validasi Balance
  const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return c.json({ success: false, message: 'Jurnal tidak balance. Total Debit harus sama dengan Kredit.' }, 400)
  }
  
  if (totalDebit <= 0) {
    return c.json({ success: false, message: 'Nilai jurnal tidak boleh nol.' }, 400)
  }

  try {
    const entryId = crypto.randomUUID()
    const actor = getActor(c)
    const adminId = getJwtPayload(c)?.sub || null

    await db.transaction(async () => {
      // 1. Insert Header
      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entryId, data.transaction_date, data.description, data.reference_type || null, data.reference_id || null, adminId])

      // 2. Insert Lines
      for (const line of data.lines) {
        await db.run(`
          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        `, [entryId, line.account_id, line.debit, line.credit, line.description || null])
      }
    })();

    await audit(db, {
      actor,
      action: 'create_journal',
      entity: 'journal_entries',
      entityId: entryId,
      after: {
        ...data,
        total_amount: totalDebit
      },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Jurnal berhasil dicatat', id: entryId }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

// ---------------------------------------------------------------------------
// Journal Reversal (Koreksi / Storno)
// ---------------------------------------------------------------------------

accounting.post('/journals/:id/reverse', requirePermission('create:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const actor = getActor(c)
  const adminId = getJwtPayload(c)?.sub || null

  // 1. Load the original entry
  const entry = await db.query(`SELECT * FROM journal_entries WHERE id = $1`).get<{ id: string; transaction_date: string; description: string; reference_type: string | null; reference_id: string | null }>(id)
  if (!entry) return c.json({ success: false, message: 'Jurnal tidak ditemukan' }, 404)

  // Check if this entry was already reversed (has a reversal entry)
  const alreadyReversed = await db.query(
    `SELECT id FROM journal_entries WHERE reference_type = 'reversal_of' AND reference_id = $1`
  ).get(id)
  if (alreadyReversed) {
    return c.json({ success: false, message: 'Jurnal ini sudah pernah dikoreksi sebelumnya.' }, 400)
  }

  // 2. Load original lines
  const lines = await db.query(`
    SELECT jl.*, a.code as account_code
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE jl.journal_entry_id = $1
  `).all<{ id: string; account_id: string; debit: number; credit: number; description: string | null }>(id)

  if (lines.length === 0) return c.json({ success: false, message: 'Jurnal tidak memiliki baris' }, 400)

  try {
    const reversalId = crypto.randomUUID()
    const today = new Date().toISOString().split('T')[0]

    await db.transaction(async () => {
      // Insert reversal header
      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        reversalId,
        today,
        `[KOREKSI] ${entry.description}`,
        'reversal_of',
        id,
        adminId,
      ])

      // Insert reversed lines (swap debit ↔ credit)
      for (const line of lines) {
        await db.run(`
          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        `, [
          reversalId,
          line.account_id,
          line.credit,   // swapped
          line.debit,    // swapped
          line.description ? `[Koreksi] ${line.description}` : '[Koreksi]',
        ])
      }
    })()

    await audit(db, {
      actor,
      action: 'reverse_journal',
      entity: 'journal_entries',
      entityId: reversalId,
      after: { reversed_entry_id: id },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Jurnal koreksi berhasil dibuat', id: reversalId }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

// ---------------------------------------------------------------------------
// Journal Delete (Hapus) — superadmin only
// ---------------------------------------------------------------------------

accounting.delete('/journals/:id', requirePermission('delete:accounting'), async (c) => {
  const id = requireRouteParam(c, 'id')
  const actor = getActor(c)

  const entry = await db.query(`SELECT * FROM journal_entries WHERE id = $1`).get<{ id: string; description: string; reference_type: string | null }>(id)
  if (!entry) return c.json({ success: false, message: 'Jurnal tidak ditemukan' }, 404)

  // Block deletion of auto-generated journals (they are owned by business logic)
  const autoTypes = ['loan_disbursement', 'loan_payment', 'savings_setor', 'savings_tarik']
  if (entry.reference_type && autoTypes.includes(entry.reference_type)) {
    return c.json({
      success: false,
      message: 'Jurnal otomatis (dari simpanan/pinjaman) tidak dapat dihapus langsung. Gunakan fitur Koreksi.',
    }, 400)
  }

  try {
    await db.transaction(async () => {
      await db.run(`DELETE FROM journal_lines WHERE journal_entry_id = $1`, [id])
      await db.run(`DELETE FROM journal_entries WHERE id = $1`, [id])
    })()

    await audit(db, {
      actor,
      action: 'delete_journal',
      entity: 'journal_entries',
      entityId: id,
      before: { description: entry.description, reference_type: entry.reference_type },
      ip: getClientIp(c),
    })

    return c.json({ success: true, message: 'Jurnal berhasil dihapus' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

// ---------------------------------------------------------------------------
// General Ledger
// ---------------------------------------------------------------------------

accounting.get('/ledger', requirePermission('read:accounting'), async (c) => {
  const rows = await db.query(`
    SELECT 
      a.id, a.code, a.name, a.type, a.normal_balance,
      COALESCE(SUM(l.debit), 0) as total_debit,
      COALESCE(SUM(l.credit), 0) as total_credit,
      CASE 
        WHEN a.normal_balance = 'DEBIT' THEN COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0)
        ELSE COALESCE(SUM(l.credit), 0) - COALESCE(SUM(l.debit), 0)
      END as balance
    FROM accounts a
    LEFT JOIN journal_lines l ON a.id = l.account_id
    GROUP BY a.id, a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code ASC
  `).all()
  
  return c.json({ success: true, data: rows })
})

export default accounting


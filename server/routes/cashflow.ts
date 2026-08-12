import { Hono } from 'hono'
import db from '../db'
import type { CashflowRow } from '../db/entities'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'

const cashflow = new Hono()

cashflow.get('/', requirePermission('read:cashflow'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  // Ambil total Debit Kas (Inflow) dan Kredit Kas (Outflow)
  // Berdasarkan akun kas: 11101 (Kas Kecil) dan 11102 (Bank Mandiri)
  const totalsRes = await db.query(`
    SELECT 
      SUM(jl.debit) as total_inflow,
      SUM(jl.credit) as total_outflow
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
  `).get() as { total_inflow: number | null; total_outflow: number | null }

  const totalInflow = Number(totalsRes?.total_inflow ?? 0) || 0
  const totalOutflow = Number(totalsRes?.total_outflow ?? 0) || 0
  const netCash = totalInflow - totalOutflow

  const queryStr = `
    SELECT 
      'journal' as source,
      jl.id as id,
      je.transaction_date as "date",
      'Koperasi' as "partyName",
      je.description as description,
      CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END as amount,
      CASE WHEN jl.debit > 0 THEN 'inflow' ELSE 'outflow' END as "flowType"
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
    ORDER BY je.transaction_date DESC, je.created_at DESC
    LIMIT ? OFFSET ?
  `

  const rows = await db.query(queryStr).all<CashflowRow>(limit, offset)

  const mappedRows = rows.map(r => {
    let partyName = r.partyName;
    let description = r.description;
    
    // Extract party name if formatted as "Some Action — Person Name"
    if (description && description.includes(' — ')) {
      const parts = description.split(' — ');
      description = parts[0];
      partyName = parts[1];
    }
    
    return { ...r, partyName, description };
  });

  const countQuery = `
    SELECT COUNT(*) as count 
    FROM journal_lines jl
    JOIN accounts a ON jl.account_id = a.id
    WHERE a.code IN ('11101', '11102')
  `
  const totalRes = await db.query(countQuery).get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: mappedRows,
      total: totalRes?.count ?? 0,
      page,
      limit,
      summary: {
        totalInflow,
        totalOutflow,
        netCash
      }
    }
  })
})

export default cashflow

import { Hono } from 'hono'
import db from '../db'
import { expenseSchema, expenseUpdateSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from '../services/expenseService'
import { mapServiceError, requireRouteParam } from '../lib/serviceResponse'
import { audit, getActor, getClientIp } from '../lib/audit'
import { clearStatsCache } from './stats'

const expenses = new Hono()

expenses.get('/', requirePermission('read:expenses'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const { rows, total } = await listExpenses(db, page, limit)

  return c.json({
    success: true,
    data: {
      data: rows,
      total,
      page,
      limit,
    },
  })
})

expenses.post('/', requirePermission('create:expenses'), async (c) => {
  const body = await c.req.json()
  const parsed = expenseSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const { id } = await createExpense(db, parsed.data, getActor(c))

    await audit(db, {
      actor: getActor(c),
      action: 'create_expense',
      entity: 'expenses',
      entityId: id,
      after: { ...parsed.data },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Pengeluaran berhasil dicatat', id }, 201)
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

expenses.put('/:id', requirePermission('update:expenses'), async (c) => {
  const body = await c.req.json()
  const parsed = expenseUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ success: false, errors: parsed.error.format() }, 400)
  }

  try {
    const id = requireRouteParam(c, 'id')
    const { before, after } = await updateExpense(db, id, parsed.data)

    await audit(db, {
      actor: getActor(c),
      action: 'update_expense',
      entity: 'expenses',
      entityId: id,
      before: {
        expenseDate: before.expenseDate,
        category: before.category,
        description: before.description,
        amount: before.amount,
        paymentMethod: before.paymentMethod,
      },
      after: {
        expenseDate: after.expenseDate,
        category: after.category,
        description: after.description,
        amount: after.amount,
        paymentMethod: after.paymentMethod,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Pengeluaran diperbarui', data: after })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

expenses.delete('/:id', requirePermission('delete:expenses'), async (c) => {
  try {
    const id = requireRouteParam(c, 'id')
    const { before } = await deleteExpense(db, id)

    await audit(db, {
      actor: getActor(c),
      action: 'delete_expense',
      entity: 'expenses',
      entityId: id,
      before: {
        expenseDate: before.expenseDate,
        category: before.category,
        description: before.description,
        amount: before.amount,
      },
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true, message: 'Pengeluaran dihapus' })
  } catch (err) {
    const response = mapServiceError(c, err)
    if (response) return response
    throw err
  }
})

export default expenses

import { Hono } from 'hono'
import db from '../db'
import { loanSchema, loanStatusSchema, paymentSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { parsePagination } from '../services/pagination'
import { calculateLoanInterest } from '../services/loanService'
import { clearStatsCache } from './stats'

const loans = new Hono()

/**
 * Snapshot the interest rate and terms when a loan is approved. This ensures that
 * future changes to the global `bungaPinjaman` setting do not retroactively alter
 * historical loans (NPL, SHU calculations rely on snapshot values).
 */
async function snapshotLoanTerms(loanId: string) {
  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRatePercent = parseFloat(bungaSetting?.value || '0');

  const loan = await db.query("SELECT amount, tenor FROM loans WHERE id = ?").get(loanId) as { amount: number, tenor: string } | null;
  if (!loan) return;

  // calculateLoanInterest expects annual percent (e.g., 18 for 18%)
  const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRatePercent);

  await db.run(`UPDATE loans SET
    interestRate = ?, monthlyPayment = ?, interestAmount = ?, totalAmount = ?, approvedAt = CURRENT_TIMESTAMP
    WHERE id = ?`, [bungaRatePercent, Math.round(totalAmount / parseInt(loan.tenor)), interestAmount, totalAmount, loanId]);
}

loans.get('/', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT l.*, COALESCE(SUM(p.amount), 0) as paidAmount
    FROM loans l
    LEFT JOIN loan_payments p ON l.id = p.loanId
    GROUP BY l.id
    ORDER BY l.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]

  // Load current settings once for pending loans (avoid await inside map)
  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '0');

  const mappedLoans = rows.map(loan => {
    // Use snapshot values for approved loans (historical consistency)
    if (loan.approvedAt && loan.totalAmount !== null) {
      return {
        ...loan,
        interestAmount: loan.interestAmount,
        totalAmount: loan.totalAmount
      };
    }

    // Fallback: recalculate for pending loans using current settings
    const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate);

    return {
      ...loan,
      interestAmount,
      totalAmount
    };
  });

  const totalRes = await db.query("SELECT COUNT(*) as count FROM loans").get() as { count: number }

  return c.json({
    success: true,
    data: {
      data: mappedLoans,
      total: totalRes.count,
      page,
      limit
    }
  })
})

loans.post('/', requirePermission('create:loans'), async (c) => {
  try {
    const body = await c.req.json()
    const parsed = loanSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { memberId, name, amount, tenor, purpose, status } = parsed.data
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()

    const insert = await db.prepare(`
      INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    await insert.run(id, memberId, name, amount, tenor, purpose, status, createdAt)
    clearStatsCache()

    return c.json({ success: true, message: 'Loan created successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

loans.put('/:id/status', requirePermission('approve:loans'), async (c) => {
  try {
    const id = c.req.param('id')
    console.log("Hono PUT /api/loans/:id/status called with id:", id)
    const body = await c.req.json()
    console.log("Request body:", body)
    const parsed = loanStatusSchema.safeParse(body)

    if (!parsed.success) {
      console.log("Validation failed:", parsed.error.format())
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { status } = parsed.data
    console.log("Status to update:", status)

    // Use atomic transaction for approve + snapshot when approved
    if (status === 'Disetujui') {
      await db.transaction(async () => {
        const stmt = await db.prepare(`UPDATE loans SET status = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ?`)
        await stmt.run(status, id)

        // Capture snapshot values using shared calculation logic
        const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
        const bungaRatePercent = parseFloat(bungaSetting?.value || '0');

        const loan = await db.query("SELECT id, amount, tenor, scheduleGenerated FROM loans WHERE id = ?").get(id) as { id: string, amount: number, tenor: string, scheduleGenerated: boolean } | null;
        if (loan && !loan.scheduleGenerated) {
          // Use calculateLoanInterest from loanService for consistent calculation
          const { interestAmount, totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRatePercent);
          const monthlyPayment = Math.ceil(totalAmount / parseInt(loan.tenor));

          await db.run(`UPDATE loans SET interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ? WHERE id = ?`,
            [bungaRatePercent, monthlyPayment, totalAmount, interestAmount, id]);

          // Generate installment schedule
          const tenorMonths = parseInt(loan.tenor);
          const annualRatePercent = bungaRatePercent;
          const i = annualRatePercent / 1200; // Monthly rate
          const power = Math.pow(1 + i, tenorMonths);
          const baseMonthlyPayment = loan.amount * (i * power) / (power - 1);
          const roundedBasePayment = Math.ceil(baseMonthlyPayment);

          for (let month = 1; month <= tenorMonths; month++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() + month);

            // Calculate principal and interest for this installment
            const remainingPrincipal = loan.amount - (loan.amount * (month - 1) / tenorMonths);
            const currentPrincipal = Math.floor(remainingPrincipal / (tenorMonths - month + 1));
            const currentInterest = Math.round((loan.amount - currentPrincipal * (tenorMonths - month + 1)) * i);

            await db.run(`
              INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
              VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')
              ON CONFLICT (loanId, installmentNo) DO NOTHING
            `, [
              `${loan.id}-${month}`,
              loan.id,
              month,
              dueDate.toISOString().split('T')[0], // YYYY-MM-DD format
              currentPrincipal,
              currentInterest
            ]);
          }

          await db.run(`UPDATE loans SET scheduleGenerated = TRUE, totalInstallments = ? WHERE id = ?`, [tenorMonths, id]);
        }
      })();
    } else {
      const stmt = await db.prepare(`UPDATE loans SET status = ? WHERE id = ?`)
      await stmt.run(status, id)
    }

    console.log("Database update executed successfully")
    clearStatsCache()
    return c.json({ success: true, message: 'Loan status updated' })
  } catch (error) {
    throw error
  }
})

loans.get('/payments', requirePermission('read:loans'), async (c) => {
  const { page, limit } = parsePagination(c.req.query('page'), c.req.query('limit'))
  const offset = (page - 1) * limit

  const rows = await db.query(`
    SELECT * FROM (
      SELECT
        'pencairan' as "type",
        l.id || '-disburse' as "id",
        l.id as "loanId",
        l.amount as "amount",
        l.createdAt as "paymentDate",
        'Transfer' as "method",
        l.name as "borrowerName"
      FROM loans l
      WHERE l.status IN ('Disetujui', 'Lunas', 'Macet')

      UNION ALL

      SELECT
        'angsuran' as "type",
        p.id as "id",
        p.loanId as "loanId",
        p.amount as "amount",
        p.paymentDate as "paymentDate",
        p.method as "method",
        l.name as "borrowerName"
      FROM loan_payments p
      LEFT JOIN loans l ON p.loanId = l.id
    ) combined
    ORDER BY "paymentDate" DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[]

  const totalRes = await db.query(`
    SELECT (
      (SELECT COUNT(*) FROM loans WHERE status IN ('Disetujui', 'Lunas', 'Macet')) +
      (SELECT COUNT(*) FROM loan_payments)
    ) as count
  `).get() as { count: number }

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

loans.get('/:id/payments', requirePermission('read:loans'), async (c) => {
  const id = c.req.param('id')
  const payments = await db.query("SELECT * FROM loan_payments WHERE loanId = ? ORDER BY paymentDate DESC").all(id)
  return c.json({ success: true, data: payments })
})

loans.post('/:id/payments', requirePermission('create:payments'), async (c) => {
  try {
    const loanId = c.req.param('id')
    const body = await c.req.json()
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const { amount, method } = parsed.data

    const loan = await db.query("SELECT * FROM loans WHERE id = ?").get(loanId) as any;
    if (!loan) return c.json({ success: false, message: 'Loan not found' }, 404);

    // Use snapshot values for approved loans (historical consistency)
    let totalAmount: number;
    if (loan.approvedAt && loan.totalAmount !== null) {
      totalAmount = Number(loan.totalAmount);
    } else {
      const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
      const bungaRate = parseFloat(bungaSetting?.value || '0');
      ({ totalAmount } = calculateLoanInterest(loan.amount, loan.tenor, bungaRate));
    }

    const paid = Number((await db.query("SELECT SUM(amount) as paid FROM loan_payments WHERE loanId = ?").get(loanId) as any).paid || 0);

    if (paid + amount > totalAmount) {
      return c.json({ success: false, message: 'Total pembayaran melebihi jumlah pinjaman' }, 400);
    }

    const id = crypto.randomUUID()
    const paymentDate = new Date().toISOString()

    await db.transaction(async () => {
      // Record the payment
      const stmt = await db.prepare(`
        INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
        VALUES (?, ?, ?, ?, ?)
      `)
      await stmt.run(id, loanId, amount, paymentDate, method)

      // Allocate payment to oldest unpaid installments first
      const remainingPayment = paid + amount - totalAmount > 0 ? 0 : amount; // Simplified: assume payment fits within total
      let allocatedAmount = amount;

      // Get all pending installments for this loan, ordered by due date
      const pendingSchedules = await db.query(`
        SELECT * FROM loan_schedules
        WHERE loanId = ? AND status = 'Pending'
        ORDER BY installmentNo ASC
      `).all(loanId) as any[];

      if (pendingSchedules.length > 0) {
        const today = new Date();
        for (const schedule of pendingSchedules) {
          if (allocatedAmount <= 0) break;

          const dueDate = new Date(schedule.dueDate);
          const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Check for late fee if applicable
          let lateFee = 0;
          if (daysLate > 0) {
            const dendaSetting = await db.query("SELECT value FROM settings WHERE key = 'denda'").get() as { value: string } | undefined;
            const dendaPercent = parseFloat(dendaSetting?.value || '0');
            lateFee = Math.round(schedule.principalAmount * (dendaPercent / 100));
          }

          const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + lateFee;
          const paymentForThisInstallment = Math.min(allocatedAmount, totalDue - Number(schedule.paidAmount || 0));

          if (paymentForThisInstallment > 0) {
            // Update the schedule with partial or full payment
            const newPaidAmount = Number(schedule.paidAmount || 0) + paymentForThisInstallment;
            const isFullyPaid = newPaidAmount >= totalDue;

            await db.run(`UPDATE loan_schedules SET paidAmount = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
              [newPaidAmount, isFullyPaid ? 'Paid' : 'Pending', schedule.id]);

            allocatedAmount -= paymentForThisInstallment;

            // If fully paid and there are more installments due, check aging for this loan
            if (isFullyPaid) {
              // Check if all installments are paid
              const remainingPending = await db.query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Pending'`).get(loanId) as any;
              if (Number(remainingPending.count || 0) === 0) {
                // All installments paid, mark loan as Lunas
                await db.run(`UPDATE loans SET status = 'Lunas', paidInstallments = totalInstallments WHERE id = ?`, [loanId]);
              }
            }
          }
        }

        // Update loan paid installment count
        const paidInstallmentCount = await db.query(`SELECT COUNT(*) as count FROM loan_schedules WHERE loanId = ? AND status = 'Paid'`).get(loanId) as any;
        if (paidInstallmentCount && Number(paidInstallmentCount.count || 0) > 0) {
          await db.run(`UPDATE loans SET paidInstallments = ? WHERE id = ?`, [Number(paidInstallmentCount.count), loanId]);
        }

        // Check aging: if any installment is overdue, check DPD thresholds
        const overdueSchedules = await db.query(`
          SELECT * FROM loan_schedules
          WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE
          ORDER BY dueDate ASC LIMIT 1
        `).all(loanId) as any[];

        if (overdueSchedules.length > 0) {
          const oldestOverdue = overdueSchedules[0];
          const oldestDueDate = new Date(oldestOverdue.dueDate);
          const dpd = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Apply aging based on DPD thresholds
          if (dpd >= 90) {
            await db.run(`UPDATE loans SET status = 'Macet' WHERE id = ?`, [loanId]);
          } else if (dpd >= 60 && loan.status === 'Disetujui') {
            // Could add intermediate status like 'Risiko Tinggi' if needed
          } else if (dpd >= 30 && loan.status === 'Disetujui') {
            // Could add warning status here
          }

          // Update schedule status to Late for overdue installments
          await db.run(`UPDATE loan_schedules SET status = 'Late', updatedAt = CURRENT_TIMESTAMP WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE`, [loanId]);
        }
      } else {
        // No schedules, check if all paid based on totalAmount
        const newTotalPaid = paid + amount;
        if (newTotalPaid >= totalAmount) {
          await db.run(`UPDATE loans SET status = 'Lunas' WHERE id = ?`, [loanId]);
        }
      }
    })()

    clearStatsCache()

    return c.json({ success: true, message: 'Payment recorded successfully', id }, 201)
  } catch (error) {
    throw error
  }
})

loans.delete('/:id', requirePermission('delete:loans'), async (c) => {
  try {
    const id = c.req.param('id')
    const loan = await db.query("SELECT id FROM loans WHERE id = ?").get(id)
    if (!loan) {
      return c.json({ success: false, message: 'Loan not found' }, 404)
    }
    const stmt = await db.prepare("DELETE FROM loans WHERE id = ?")
    await stmt.run(id)
    clearStatsCache()
    return c.json({ success: true, message: 'Loan deleted successfully' })
  } catch (error) {
    throw error
  }
})

export default loans
import db from '../db';
import type { LoanRow } from '../db/entities';

/**
 * Check and update loan aging based on DPD (Days Past Due).
 * This should be run as a cron job or scheduled task.
 *
 * Aging buckets:
 * - Current: 0-30 days past due
 * - 30-60: 31-60 days past due
 * - 60-90: 61-90 days past due
 * - 90+: Over 90 days past due (NPL)
 */
export async function checkAndApplyAging(): Promise<{
  checked: number;
  updatedToMacet: number;
  updatedToLate: number;
}> {
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));

  // Find all loans with pending installments that are overdue
  const overdueLoans = await db.query(`
    SELECT DISTINCT l.id, l.status
    FROM loans l
    JOIN loan_schedules ls ON l.id = ls.loanId AND ls.status = 'Pending'
    WHERE ls.dueDate < CURRENT_DATE
    AND l.status IN ('Disetujui', 'Macet')
  `).all<Pick<LoanRow, 'id' | 'status'>>();

  let updatedToMacet = 0;
  let updatedToLate = 0;

  for (const loan of overdueLoans) {
    // Get the oldest overdue installment date
    const oldestOverdue = await db.query(`
      SELECT MIN(ls.dueDate) as oldestDueDate
      FROM loan_schedules ls
      WHERE ls.loanId = ? AND ls.status = 'Pending' AND ls.dueDate < CURRENT_DATE
    `).get<{ oldestDueDate: string }>(loan.id);

    if (!oldestOverdue?.oldestDueDate) continue;

    const oldestDueDate = new Date(oldestOverdue.oldestDueDate);
    const dpd = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Apply aging based on DPD thresholds
    if (dpd >= 90 && loan.status !== 'Macet') {
      await db.run(`UPDATE loans SET status = 'Macet' WHERE id = ?`, [loan.id]);
      updatedToMacet++;
    }

    // Mark overdue installments as Late
    const updatedRows = await db.query(`
      UPDATE loan_schedules
      SET status = 'Late', updatedAt = CURRENT_TIMESTAMP
      WHERE loanId = ? AND status = 'Pending' AND dueDate < CURRENT_DATE
      RETURNING id
    `).all(loan.id);

    if (updatedRows.length > 0) {
      updatedToLate += updatedRows.length;
    }
  }

  return {
    checked: overdueLoans.length,
    updatedToMacet,
    updatedToLate
  };
}

/**
 * Run aging check immediately (for testing or manual trigger).
 */
export async function runAgingCheck(): Promise<{
  success: boolean;
  result?: { checked: number; updatedToMacet: number; updatedToLate: number };
  error?: string;
}> {
  try {
    const result = await checkAndApplyAging();
    return { success: true, result };
  } catch (error) {
    console.error('[AGING] Error running aging check:', error);
    return { success: false, error: String(error) };
  }
}
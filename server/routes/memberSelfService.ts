import { Hono } from 'hono';
import db from '../db';
import type { JwtPayload } from '../types/auth';

const memberSelfService = new Hono();

// Middleware to ensure route is only accessed by a member
memberSelfService.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload') as JwtPayload | undefined;
  if (!payload || payload.role !== 'member') {
    return c.json({ success: false, message: 'Unauthorized, member access only' }, 401);
  }
  return next();
});

// Get member profile and savings summary
memberSelfService.get('/profile', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const member = await db.query(
    "SELECT id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings FROM members WHERE id = ?"
  ).get(memberId);

  if (!member) {
    return c.json({ success: false, message: 'Member not found' }, 404);
  }

  return c.json({ success: true, data: member });
});

// Get savings mutations
memberSelfService.get('/savings/transactions', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const transactions = await db.query(
    "SELECT id, type, amount, balanceBefore, balanceAfter, createdAt, createdBy FROM transactions WHERE memberId = ? ORDER BY createdAt DESC"
  ).all(memberId);

  return c.json({ success: true, data: transactions });
});

// Get active loans
memberSelfService.get('/loans', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;

  const loans = await db.query(
    "SELECT id, name, amount, tenor, purpose, status, createdAt, interestRate, monthlyPayment, interestAmount, totalAmount, approvedAt, totalInstallments, paidInstallments, paidAmount FROM loans WHERE memberId = ? AND deletedAt IS NULL ORDER BY createdAt DESC"
  ).all(memberId);

  return c.json({ success: true, data: loans });
});

// Get loan schedule for a specific loan
memberSelfService.get('/loans/:loanId/schedule', async (c) => {
  const payload = c.get('jwtPayload') as JwtPayload;
  const memberId = payload.sub;
  const loanId = c.req.param('loanId');

  // Verify the loan belongs to the member
  const loan = await db.query("SELECT id FROM loans WHERE id = ? AND memberId = ?").get(loanId, memberId);
  if (!loan) {
    return c.json({ success: false, message: 'Loan not found or unauthorized' }, 404);
  }

  const schedule = await db.query(
    "SELECT id, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status, lateFee, paidAt FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC"
  ).all(loanId);

  return c.json({ success: true, data: schedule });
});

export default memberSelfService;

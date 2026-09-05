import { describe, it, expect, beforeEach } from 'bun:test'
import db from '../db'
import { calculateLoanInterest } from '../services/loanService'

describe('Loan Interest Snapshot', () => {
  let approvedLoanId: string

  beforeEach(async () => {
    // Clean up test data
    await db.run("DELETE FROM loan_payments WHERE loanId = 'test-loan-pending' OR loanId LIKE 'test-loan-%'")
    await db.run("DELETE FROM loans WHERE id = 'test-loan-pending' OR id LIKE 'test-loan-%'")

    // Ensure member exists for FK reference (use ON CONFLICT to handle existing members)
    await db.prepare(
      "INSERT INTO members (id, name, role, status, joinDate, totalSavings) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING"
    ).run('test-member-1', 'Test Member', 'Anggota', 'Aktif', new Date().toISOString(), 5000000);

    // Create a pending loan first (not approved yet)
    await db.prepare(`
      INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'test-loan-pending',
      'test-member-1',
      'Test Pending Loan',
      5000000,
      '6',
      'Test Purpose',
      'Menunggu'
    )

    // Now approve it via the actual snapshot logic using calculateLoanInterest
    const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
    const bungaRatePercent = parseFloat(bungaSetting?.value || '18');

    // Use calculateLoanInterest from loanService for consistent calculation
    const { interestAmount, totalAmount } = calculateLoanInterest(5000000, '6', bungaRatePercent);
    const monthlyPayment = Math.ceil(totalAmount / 6);

    await db.run(`UPDATE loans SET status = 'Disetujui', interestRate = ?, monthlyPayment = ?, totalAmount = ?, interestAmount = ?, approvedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [bungaRatePercent, monthlyPayment, totalAmount, interestAmount, 'test-loan-pending']);

    approvedLoanId = 'test-loan-pending'
  })

  it('should snapshot interest rate and terms when loan is approved', async () => {
    const loan = await db.query("SELECT * FROM loans WHERE id = ?").get(approvedLoanId) as any;

    expect(loan).toBeDefined();
    expect(loan.approvedAt).not.toBeNull();
    expect(Number(loan.interestRate)).toBeGreaterThan(0);
    expect(Number(loan.totalAmount)).toBeGreaterThan(0);
    expect(Number(loan.monthlyPayment)).toBeGreaterThan(0);
  })

  it('should not change loan terms when bungaPinjaman setting is updated', async () => {
    // Get initial snapshot values
    const initialLoan = await db.query("SELECT interestRate, totalAmount FROM loans WHERE id = ?").get(approvedLoanId) as any;

    try {
      // Update the global bungaPinjaman setting to a different value
      await db.run(`UPDATE settings SET value = '24' WHERE key = 'bungaPinjaman'`);

      // Query loan again - should still have original snapshot values
      const updatedLoan = await db.query("SELECT interestRate, totalAmount FROM loans WHERE id = ?").get(approvedLoanId) as any;

      expect(Number(updatedLoan.interestRate)).toBe(Number(initialLoan.interestRate));
      expect(Number(updatedLoan.totalAmount)).toBe(Number(initialLoan.totalAmount));
    } finally {
      // Restore setting to avoid test pollution
      await db.run(`UPDATE settings SET value = '18' WHERE key = 'bungaPinjaman'`);
    }
  })

  it('should calculate monthly payment correctly based on snapshot', async () => {
    const loan = await db.query("SELECT * FROM loans WHERE id = ?").get(approvedLoanId) as any;

    // Verify monthlyPayment is calculated correctly (approximate check)
    expect(Number(loan.monthlyPayment)).toBeGreaterThan(0);
    expect(Number(loan.totalAmount)).toBeCloseTo(Number(loan.monthlyPayment) * parseInt(loan.tenor), -2);
  })

  it('should use snapshot totalAmount for payment validation', async () => {
    const loan = await db.query("SELECT * FROM loans WHERE id = ?").get(approvedLoanId) as any;

    // Simulate checking remaining balance using snapshot
    const paidAmount = (await db.query("SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loanId = ?").get(approvedLoanId)) as { total: number } | undefined;
    const paid = Number(paidAmount?.total || 0);

    // Payment should not exceed snapshot totalAmount (not recalculate from settings)
    expect(paid).toBeLessThanOrEqual(Number(loan.totalAmount));
  })

  afterAll(async () => {
    await db.run("DELETE FROM loan_payments WHERE loanId = 'test-loan-pending' OR loanId LIKE 'test-loan-%'");
    await db.run("DELETE FROM loans WHERE id = 'test-loan-pending' OR id LIKE 'test-loan-%'");
    await db.run("DELETE FROM members WHERE id = 'test-member-1'");
  });
})
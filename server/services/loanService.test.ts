import { expect, test, describe } from "bun:test";
import db from "../db";
import {
  calculateLoanInterest,
  createLoan,
  recordLoanPayment,
  resolveLoanTotalAmount,
} from "./loanService";
import { ServiceError } from "./errors";

describe("loanService", () => {
  test("calculateLoanInterest returns correct interest and total amount", () => {
    // 10,000,000 amount, 12 months tenor, 18% annual interest (1.5% monthly)
    const res = calculateLoanInterest(10000000, "12", 18);
    expect(res.interestAmount).toBe(1001600); // Annuity calculation
    expect(res.totalAmount).toBe(11001600);
  });

  test("calculateLoanInterest handles zero interest rate", () => {
    const res = calculateLoanInterest(5000000, "6", 0);
    expect(res.interestAmount).toBe(0);
    expect(res.totalAmount).toBe(5000000);
  });

  test("calculateLoanInterest handles fallback for invalid tenor", () => {
    const res = calculateLoanInterest(2000000, "invalid-tenor", 24.0);
    // Should fallback to 1 month tenor: 24% annual = 2% monthly: 2,040,000 total
    expect(res.interestAmount).toBe(40000);
    expect(res.totalAmount).toBe(2040000);
  });

  test("createLoan inserts a pending loan row", async () => {
    const memberId = crypto.randomUUID();
    const loanName = `Loan Service ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2026", 1000, 0, 0, 1000]
    );

    const { id: loanId } = await createLoan(db, {
      memberId,
      name: loanName,
      amount: 10000,
      tenor: 10,
      purpose: "Unit test",
      status: "Menunggu",
    });

    const loan = await db.query("SELECT amount, status FROM loans WHERE id = ?").get(loanId) as {
      amount: number;
      status: string;
    } | null;
    expect(loan?.status).toBe("Menunggu");
    expect(Number(loan?.amount)).toBe(10000);

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("recordLoanPayment rejects overpayment", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Overpay ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2026", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, 1000000, 12, "Test", "Disetujui", new Date().toISOString()]
    );

    const loan = await db.query("SELECT * FROM loans WHERE id = ?").get(loanId);
    const totalAmount = await resolveLoanTotalAmount(db, loan as never);

    await expect(
      recordLoanPayment(db, loanId, { amount: totalAmount + 1, method: "Transfer" })
    ).rejects.toMatchObject({
      message: "Total pembayaran melebihi jumlah pinjaman",
      status: 400,
    });

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("recordLoanPayment throws when loan is missing", async () => {
    await expect(
      recordLoanPayment(db, crypto.randomUUID(), { amount: 1000, method: "Cash" })
    ).rejects.toBeInstanceOf(ServiceError);
  });
});

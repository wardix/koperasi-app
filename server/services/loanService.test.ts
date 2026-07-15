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
  describe("calculateLoanInterest table tests", () => {
    const cases = [
      { principal: 10000000, tenor: 12, rate: 18, expInterest: 1001600, expTotal: 11001600 },
      { principal: 5000000, tenor: 6, rate: 0, expInterest: 0, expTotal: 5000000 },
      { principal: 2000000, tenor: 1, rate: 24, expInterest: 40000, expTotal: 2040000 },
      { principal: 2000000, tenor: "invalid-tenor", rate: 24.0, expInterest: 40000, expTotal: 2040000 },
      { principal: 1000000, tenor: 3, rate: 12, expInterest: 20069, expTotal: 1020069 },
    ];

    cases.forEach(({ principal, tenor, rate, expInterest, expTotal }) => {
      test(`P=${principal}, T=${tenor}, R=${rate}% -> I=${expInterest}, Tot=${expTotal}`, () => {
        const res = calculateLoanInterest(principal, tenor, rate);
        expect(res.interestAmount).toBe(expInterest);
        expect(res.totalAmount).toBe(expTotal);
      });
    });
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

  test("recordLoanPayment prevents overpayment under concurrent requests", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Concurrent ${memberId}`;

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

    // Try to pay (totalAmount - 100) twice concurrently.
    // The first should succeed, the second should fail because remaining balance is 100.
    const paymentAmount = totalAmount - 100;

    const promises = [
      recordLoanPayment(db, loanId, { amount: paymentAmount, method: "Transfer" }),
      recordLoanPayment(db, loanId, { amount: paymentAmount, method: "Transfer" }),
    ];

    const results = await Promise.allSettled(promises);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one should succeed and one should fail due to overpayment
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason.message).toBe("Total pembayaran melebihi jumlah pinjaman");
    }

    await db.run("DELETE FROM loan_payments WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });
});

import { expect, test, describe } from "bun:test";
import db from "../db";
import {
  calculateLoanInterest,
  createLoan,
  deleteLoanPayment,
  recordLoanPayment,
  resolveLoanTotalAmount,
  updateLoanDisbursementDate,
  updateLoanPayment,
  updateLoanStatus,
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

  test("createLoan respects backdated loanDate", async () => {
    const memberId = crypto.randomUUID();
    const loanName = `Backdate Loan ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );

    const { id: loanId } = await createLoan(db, {
      memberId,
      name: loanName,
      amount: 5000000,
      tenor: 12,
      purpose: "Historis",
      status: "Menunggu",
      loanDate: "2024-05-20",
    });

    const loan = await db.query("SELECT createdAt FROM loans WHERE id = ?").get(loanId) as {
      createdAt: string;
    } | null;
    const d = new Date(loan!.createdAt);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(20);

    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("updateLoanStatus Disetujui uses approvedDate for createdAt and approvedAt", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Approve Date ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, 2000000, 6, "Test", "Menunggu", new Date().toISOString()]
    );

    await updateLoanStatus(db, loanId, "Disetujui", { approvedDate: "2024-04-01" });

    const loan = await db
      .query("SELECT status, createdAt, approvedAt FROM loans WHERE id = ?")
      .get(loanId) as { status: string; createdAt: string; approvedAt: string };

    expect(loan.status).toBe("Disetujui");
    const created = new Date(loan.createdAt);
    const approved = new Date(loan.approvedAt);
    expect(created.getFullYear()).toBe(2024);
    expect(created.getMonth()).toBe(3);
    expect(created.getDate()).toBe(1);
    expect(approved.getFullYear()).toBe(2024);
    expect(approved.getMonth()).toBe(3);
    expect(approved.getDate()).toBe(1);

    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("recordLoanPayment respects backdated paymentDate", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Pay Backdate ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, totalAmount, interestAmount, approvedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, 1000000, 12, "Test", "Disetujui", "2024-01-15T12:00:00.000Z", 1000000, 0, "2024-01-15T12:00:00.000Z"]
    );

    await recordLoanPayment(db, loanId, {
      amount: 100000,
      method: "Transfer",
      paymentDate: "2024-02-10",
    });

    const pay = await db
      .query("SELECT paymentDate FROM loan_payments WHERE loanId = ?")
      .get(loanId) as { paymentDate: string } | null;
    const d = new Date(pay!.paymentDate);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(10);

    await db.run("DELETE FROM loan_payments WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("updateLoanDisbursementDate updates approvedAt and createdAt", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Disburse Edit ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, totalAmount, interestAmount, scheduleGenerated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId,
        memberId,
        loanName,
        3000000,
        6,
        "Test",
        "Disetujui",
        new Date().toISOString(),
        new Date().toISOString(),
        3000000,
        0,
        true,
      ]
    );

    const result = await updateLoanDisbursementDate(db, loanId, "2024-03-15");
    const d = new Date(result.after.approvedAt);
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);

    const loan = await db
      .query("SELECT createdAt, approvedAt FROM loans WHERE id = ?")
      .get<{ createdAt: string; approvedAt: string }>(loanId);
    expect(new Date(loan!.createdAt).getDate()).toBe(15);
    expect(new Date(loan!.approvedAt).getDate()).toBe(15);

    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("updateLoanPayment and deleteLoanPayment recalculate totals", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `EditPay ${memberId}`;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, totalAmount, interestAmount, approvedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId,
        memberId,
        loanName,
        1000000,
        12,
        "Test",
        "Disetujui",
        "2024-01-15T12:00:00.000Z",
        1000000,
        0,
        "2024-01-15T12:00:00.000Z",
      ]
    );

    const { id: paymentId } = await recordLoanPayment(db, loanId, {
      amount: 100000,
      method: "Transfer",
      paymentDate: "2024-02-01",
    });

    const updated = await updateLoanPayment(db, loanId, paymentId, {
      amount: 150000,
      paymentDate: "2024-02-05",
    });
    expect(Number(updated.after.amount)).toBe(150000);
    const d = new Date(updated.after.paymentDate);
    expect(d.getDate()).toBe(5);

    let sum = await db
      .query("SELECT COALESCE(SUM(amount),0) as paid FROM loan_payments WHERE loanId = ?")
      .get<{ paid: number }>(loanId);
    expect(Number(sum?.paid)).toBe(150000);

    await deleteLoanPayment(db, loanId, paymentId);
    sum = await db
      .query("SELECT COALESCE(SUM(amount),0) as paid FROM loan_payments WHERE loanId = ?")
      .get<{ paid: number }>(loanId);
    expect(Number(sum?.paid)).toBe(0);

    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loan_payments WHERE loanId = ?", [loanId]);
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

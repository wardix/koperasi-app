import { expect, test, describe } from "bun:test";
import db from "../db";
import {
  buildAmortizationSchedule,
  calculateLoanInterest,
  createLoan,
  deleteLoanPayment,
  recordLoanPayment,
  regenerateLoanInstallmentSchedule,
  replaceLoanInstallmentSchedule,
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

  describe("buildAmortizationSchedule (annuity / declining balance)", () => {
    test("fixed installment, rising principal, falling interest; principals sum to loan amount", () => {
      const principal = 10_000_000;
      const tenor = 12;
      const rate = 18;
      const { monthlyPayment, rows } = buildAmortizationSchedule(principal, tenor, rate);

      expect(rows).toHaveLength(tenor);
      expect(monthlyPayment).toBe(916_800);

      // Month 1: lower principal, higher interest than month 2
      expect(rows[0].principalAmount).toBeLessThan(rows[1].principalAmount);
      expect(rows[0].interestAmount).toBeGreaterThan(rows[1].interestAmount);

      // Month 1 interest ≈ balance * monthly rate
      expect(rows[0].interestAmount).toBe(Math.round(principal * (rate / 1200)));

      // Installments 1..n-1: principal + interest === fixed monthly payment
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].principalAmount + rows[i].interestAmount).toBe(monthlyPayment);
      }

      // Principal declines over the life of the loan overall
      expect(rows[0].principalAmount).toBeLessThan(rows[rows.length - 1].principalAmount);
      expect(rows[0].interestAmount).toBeGreaterThan(rows[rows.length - 1].interestAmount);

      const sumPrincipal = rows.reduce((s, r) => s + r.principalAmount, 0);
      expect(sumPrincipal).toBe(principal);
    });

    test("zero interest splits principal evenly (last gets remainder)", () => {
      const { monthlyPayment, rows } = buildAmortizationSchedule(1_000_000, 3, 0);
      expect(monthlyPayment).toBe(Math.ceil(1_000_000 / 3));
      expect(rows.every((r) => r.interestAmount === 0)).toBe(true);
      expect(rows.reduce((s, r) => s + r.principalAmount, 0)).toBe(1_000_000);
    });

    test("single-period loan is principal + one interest charge", () => {
      const { rows, monthlyPayment } = buildAmortizationSchedule(2_000_000, 1, 24);
      expect(rows).toHaveLength(1);
      expect(rows[0].principalAmount).toBe(2_000_000);
      expect(rows[0].interestAmount).toBe(40_000);
      expect(monthlyPayment).toBe(2_040_000);
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

  test("regenerateLoanInstallmentSchedule fixes wrong principal/interest and keeps payments", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Regen Sched ${memberId}`;
    const principal = 10_000_000;
    const tenor = 12;
    const rate = 18;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt, approvedAt, interestRate, scheduleGenerated, totalInstallments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loanId,
        memberId,
        loanName,
        principal,
        tenor,
        "Test",
        "Disetujui",
        "2024-01-01T00:00:00.000Z",
        "2024-01-01T00:00:00.000Z",
        rate,
        true,
        tenor,
      ]
    );

    // Seed intentionally wrong flat-principal schedule (old bug shape)
    for (let m = 1; m <= tenor; m++) {
      const dueMonth = ((m % 12) + 1).toString().padStart(2, "0");
      const dueYear = 2024 + Math.floor(m / 12);
      await db.run(
        `INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'Pending')`,
        [`${loanId}-${m}`, loanId, m, `${dueYear}-${dueMonth}-01`, 833333, m * 1000]
      );
    }

    // One payment should re-allocate onto new schedule
    await db.run(
      `INSERT INTO loan_payments (id, loanId, amount, paymentDate, method)
       VALUES (?, ?, ?, ?, ?)`,
      [`pay-${loanId}`, loanId, 916_800, "2024-02-01T00:00:00.000Z", "Transfer"]
    );

    const result = await regenerateLoanInstallmentSchedule(db, loanId);
    expect(result.rows).toBe(tenor);
    expect(result.monthlyPayment).toBe(916_800);

    const rows = await db
      .query(
        `SELECT installmentNo, principalAmount, interestAmount, paidAmount, status
         FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo ASC`
      )
      .all<{
        installmentNo: number;
        principalAmount: number;
        interestAmount: number;
        paidAmount: number;
        status: string;
      }>(loanId);

    expect(rows).toHaveLength(tenor);
    expect(Number(rows[0].principalAmount)).toBeLessThan(Number(rows[1].principalAmount));
    expect(Number(rows[0].interestAmount)).toBeGreaterThan(Number(rows[1].interestAmount));
    expect(Number(rows[0].interestAmount)).toBe(Math.round(principal * (rate / 1200)));
    expect(Number(rows[0].principalAmount) + Number(rows[0].interestAmount)).toBe(916_800);

    const sumPrincipal = rows.reduce((s, r) => s + Number(r.principalAmount), 0);
    expect(sumPrincipal).toBe(principal);

    // First installment fully covered by one monthly payment
    expect(Number(rows[0].paidAmount)).toBe(916_800);
    expect(rows[0].status).toBe("Paid");
    expect(Number(rows[1].paidAmount)).toBe(0);

    await db.run("DELETE FROM loan_payments WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
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

  test("updateLoanStatus Disetujui uses per-loan interestRate for schedule snapshot", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Custom Rate ${memberId}`;
    const principal = 10_000_000;
    const customRate = 12;

    await db.run("UPDATE settings SET value = '18' WHERE key = 'bungaPinjaman'");
    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, principal, 12, "Test", "Menunggu", "2024-01-01T00:00:00.000Z"]
    );

    await updateLoanStatus(db, loanId, "Disetujui", {
      approvedDate: "2024-01-01",
      interestRate: customRate,
    });

    const loan = await db
      .query("SELECT interestRate, monthlyPayment, totalAmount, interestAmount FROM loans WHERE id = ?")
      .get<{
        interestRate: number;
        monthlyPayment: number;
        totalAmount: number;
        interestAmount: number;
      }>(loanId);

    const expected = calculateLoanInterest(principal, 12, customRate);
    expect(Number(loan?.interestRate)).toBe(customRate);
    expect(Number(loan?.monthlyPayment)).toBe(expected.monthlyPayment);
    expect(Number(loan?.totalAmount)).toBe(expected.totalAmount);

    const schedules = await db
      .query(
        `SELECT installmentNo, principalAmount, interestAmount FROM loan_schedules
         WHERE loanId = ? ORDER BY installmentNo ASC`
      )
      .all<{ installmentNo: number; principalAmount: number; interestAmount: number }>(loanId);

    expect(schedules).toHaveLength(12);
    // First month interest ≈ principal * monthly rate (declining balance)
    expect(Number(schedules[0].interestAmount)).toBe(Math.round(principal * (customRate / 1200)));
    expect(Number(schedules[0].principalAmount)).toBeLessThan(Number(schedules[1].principalAmount));
    expect(Number(schedules[0].interestAmount)).toBeGreaterThan(Number(schedules[1].interestAmount));

    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("regenerateLoanInstallmentSchedule accepts a new interestRate override", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Regen Rate ${memberId}`;
    const principal = 5_000_000;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, principal, 6, "Test", "Menunggu", "2024-01-01T00:00:00.000Z"]
    );
    await updateLoanStatus(db, loanId, "Disetujui", { approvedDate: "2024-01-01", interestRate: 18 });

    const before = await db
      .query("SELECT monthlyPayment, interestRate FROM loans WHERE id = ?")
      .get<{ monthlyPayment: number; interestRate: number }>(loanId);

    const result = await regenerateLoanInstallmentSchedule(db, loanId, { interestRate: 10 });
    expect(result.interestRate).toBe(10);

    const after = await db
      .query("SELECT monthlyPayment, interestRate FROM loans WHERE id = ?")
      .get<{ monthlyPayment: number; interestRate: number }>(loanId);
    expect(Number(after?.interestRate)).toBe(10);
    expect(Number(after?.monthlyPayment)).not.toBe(Number(before?.monthlyPayment));
    expect(Number(after?.monthlyPayment)).toBe(calculateLoanInterest(principal, 6, 10).monthlyPayment);

    await db.run("DELETE FROM loan_schedules WHERE loanId = ?", [loanId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("replaceLoanInstallmentSchedule validates principal sum and keeps payments", async () => {
    const memberId = crypto.randomUUID();
    const loanId = crypto.randomUUID();
    const loanName = `Manual Sched ${memberId}`;
    const principal = 1_000_000;

    await db.run(
      `INSERT INTO members (id, name, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [memberId, loanName, "Anggota", "Aktif", "01 Jan 2024", 1000, 0, 0, 1000]
    );
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, purpose, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanId, memberId, loanName, principal, 2, "Test", "Menunggu", "2024-01-01T00:00:00.000Z"]
    );
    await updateLoanStatus(db, loanId, "Disetujui", { approvedDate: "2024-01-01", interestRate: 0 });

    await recordLoanPayment(db, loanId, {
      amount: 500_000,
      method: "Transfer",
      paymentDate: "2024-02-01",
    });

    await expect(
      replaceLoanInstallmentSchedule(db, loanId, [
        { installmentNo: 1, dueDate: "2024-02-01", principalAmount: 400_000, interestAmount: 10_000 },
        { installmentNo: 2, dueDate: "2024-03-01", principalAmount: 400_000, interestAmount: 10_000 },
      ])
    ).rejects.toMatchObject({ status: 400 });

    const result = await replaceLoanInstallmentSchedule(db, loanId, [
      { installmentNo: 1, dueDate: "2099-02-15", principalAmount: 600_000, interestAmount: 50_000 },
      { installmentNo: 2, dueDate: "2099-03-15", principalAmount: 400_000, interestAmount: 20_000 },
    ]);
    expect(result.rows).toBe(2);
    expect(result.interestAmount).toBe(70_000);
    expect(result.totalAmount).toBe(1_070_000);

    const rows = await db
      .query(
        `SELECT installmentNo, principalAmount, interestAmount, paidAmount, status
         FROM loan_schedules WHERE loanId = ? ORDER BY installmentNo`
      )
      .all<{
        installmentNo: number;
        principalAmount: number;
        interestAmount: number;
        paidAmount: number;
        status: string;
      }>(loanId);

    expect(Number(rows[0].principalAmount)).toBe(600_000);
    expect(Number(rows[0].interestAmount)).toBe(50_000);
    // 500k payment allocated to first installment (due 650k)
    expect(Number(rows[0].paidAmount)).toBe(500_000);
    expect(rows[0].status).toBe("Pending");

    const loan = await db
      .query("SELECT totalAmount, interestAmount, totalInstallments FROM loans WHERE id = ?")
      .get<{ totalAmount: number; interestAmount: number; totalInstallments: number }>(loanId);
    expect(Number(loan?.totalAmount)).toBe(1_070_000);
    expect(Number(loan?.interestAmount)).toBe(70_000);
    expect(Number(loan?.totalInstallments)).toBe(2);

    await db.run("DELETE FROM loan_payments WHERE loanId = ?", [loanId]);
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

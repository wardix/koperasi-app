import { Hono } from "hono";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { WalletCalculator } from "../domain/rules/wallet-calculator.js";
import { FeeSchedule } from "../domain/value-objects/fee-schedule.js";
import { mockReviewStore } from "../services/mock-review.js";

const walletRouter = new Hono();
const calculator = new WalletCalculator();

export const defaultFeeSchedule = [
  { max_amount: 100000, fee: 5000 },
  { max_amount: 250000, fee: 12500 },
  { max_amount: 500000, fee: 20000 },
  { max_amount: 750000, fee: 30000 },
  { max_amount: 1000000, fee: 35000 },
  { max_amount: 2000000, fee: 70000 },
  { max_amount: 3000000, fee: 105000 },
  { max_amount: 4000000, fee: 140000 },
  { max_amount: 5000000, fee: 175000 },
];

export async function resolveWalletBalance(employee: any, asOf: Date = new Date()) {
  const employer = typeof employee.employer === "string" 
    ? JSON.parse(employee.employer) 
    : (employee.employer || {});
  const cutoffDay = Number(employer?.cutoff_day || 25);

  // Abaikan employee.join_date (data historis tidak akurat), hitung siklus penuh dari awal cutoff
  const period = calculator.getPayPeriod(asOf, cutoffDay);

  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0)::BIGINT AS total
    FROM withdrawal_requests
    WHERE employee_id = ${employee.id}
      AND pay_period_start = ${period.start}
      AND status IN ('pending_transfer', 'transferred')
  `;
  const alreadyWithdrawn = Number(row.total);

  // Cek cicilan pinjaman koperasi aktif bulan berjalan (jika terhubung sebagai anggota)
  let coopLoanDeduction = 0;
  let memberId = employee.member_id;
  if (!memberId && (employee.email || employee.nik)) {
    const memRows = await sql`
      SELECT id FROM members
      WHERE deletedat IS NULL
        AND (
          (LOWER(email) = LOWER(${employee.email || ""}) AND ${employee.email || ""} != '')
          OR (nik = ${employee.nik || ""} AND ${employee.nik || ""} != '')
        )
      LIMIT 1
    `;
    if (memRows.length > 0) {
      memberId = memRows[0].id;
    }
  }

  if (memberId) {
    const periodMonth = period.end.slice(0, 7);
    const schedRes = await sql`
      SELECT COALESCE(SUM(ls.principalamount + ls.interestamount - ls.paidamount), 0)::BIGINT as total
      FROM loan_schedules ls
      JOIN loans l ON ls.loanid = l.id
      WHERE l.memberid = ${memberId}
        AND l.status = 'Disetujui'
        AND ls.status IN ('Pending', 'Late')
        AND TO_CHAR(ls.duedate, 'YYYY-MM') = ${periodMonth}
    `;
    coopLoanDeduction = Number(schedRes[0]?.total || 0);

    if (coopLoanDeduction === 0) {
      const fallbackLoans = await sql`
        SELECT id, amount, tenor, interestrate, monthlypayment
        FROM loans
        WHERE memberid = ${memberId} AND status = 'Disetujui'
      `;
      for (const l of fallbackLoans) {
        const countRes = await sql`
          SELECT COUNT(*)::INT as count FROM loan_schedules WHERE loanid = ${l.id}
        `;
        if (Number(countRes[0]?.count || 0) === 0) {
          coopLoanDeduction += Number(l.monthlypayment || 0);
        }
      }
    }
  }

  const dbFeeTiers = await sql`
    SELECT min_amount, max_amount, member_fee, non_member_fee 
    FROM ewa_fee_tiers 
    ORDER BY tier_order ASC
  `;

  let feeTiers: any[] = [];
  if (dbFeeTiers.length > 0) {
    const isMember = Boolean(employee.is_member);
    feeTiers = dbFeeTiers.map((t: any) => ({
      max_amount: t.max_amount !== null ? Number(t.max_amount) : null,
      fee: Number(isMember ? t.member_fee : t.non_member_fee),
    }));
  } else if (employer.fee_tiers && employer.fee_tiers.length > 0) {
    feeTiers = employer.fee_tiers;
  } else {
    feeTiers = defaultFeeSchedule;
  }
  const feeSchedule = FeeSchedule.fromArray(feeTiers);

  const maxCeiling = employer.max_withdrawal_amount !== null && employer.max_withdrawal_amount !== undefined
    ? Number(employer.max_withdrawal_amount)
    : null;

  // Kurangi gaji pokok dengan cicilan pinjaman koperasi dan terapkan batas maksimal 50% gaji efektif
  const rawSalary = Number(employee.base_salary || 0);
  const rawLimit = Number(employee.withdrawal_limit || 0);
  const baseSalary = rawSalary > 0 ? rawSalary : rawLimit;
  const effectiveSalary = Math.max(0, baseSalary - coopLoanDeduction);
  const maxMonthlyLimit = Math.floor(effectiveSalary * 0.5);

  return {
    period,
    coopLoanDeduction,
    effectiveSalary,
    balance: calculator.buildBalance(
      maxMonthlyLimit,
      period,
      alreadyWithdrawn,
      feeSchedule,
      maxCeiling
    ),
    feeSchedule,
  };
}

walletRouter.get("/balance", authMiddleware, async (c) => {
  if (c.get("isReviewMock")) {
    const mockEmployee = mockReviewStore.getEmployee();
    const cutoffDay = Number(mockEmployee.employer?.cutoff_day || 25);
    const period = calculator.getPayPeriod(new Date(), cutoffDay);
    const feeSchedule = FeeSchedule.fromArray(mockEmployee.employer?.fee_tiers || defaultFeeSchedule);
    const minimumAmount = parseInt(process.env.MINIMUM_WITHDRAWAL_AMOUNT || "50000", 10);
    const monthlySalary = 10000000;
    const accessCapAmount = 5000000;
    const withdrawals = mockReviewStore.getWithdrawals();
    const alreadyWithdrawn = withdrawals
      .filter((w) => w.status === "pending_transfer" || w.status === "transferred")
      .reduce((sum, w) => sum + w.amount, 0);
    const maxWithdrawable = Math.max(0, accessCapAmount - alreadyWithdrawn);

    return c.json({
      data: {
        withdrawal_limit: accessCapAmount,
        max_withdrawal_amount: accessCapAmount,
        effective_limit: accessCapAmount,
        capped_by_employer: false,
        daily_rate: Math.floor(accessCapAmount / period.totalDays),
        unlocked: accessCapAmount,
        already_withdrawn: alreadyWithdrawn,
        max_withdrawable: maxWithdrawable,
        fee_tiers: feeSchedule.toArray(),
        cutoff_day: cutoffDay,
        period_start: period.start,
        period_end: period.end,
        pay_period_start: period.start,
        pay_period_end: period.end,
        payday: period.payday(),
        total_days: period.totalDays,
        days_in_period: period.totalDays,
        days_elapsed: period.daysElapsed,
        days_remaining: period.daysRemaining(),
        monthly_salary: monthlySalary,
        coop_loan_deduction: 0,
        effective_salary: monthlySalary,
        gross_earned: accessCapAmount,
        access_cap_percent: 50,
        access_cap_amount: accessCapAmount,
        fee_percent: 5,
        minimum_amount: minimumAmount,
        can_request: true,
      },
    });
  }

  const employee = c.get("employee");
  const employer = typeof employee.employer === "string" 
    ? JSON.parse(employee.employer) 
    : (employee.employer || {});

  const cutoffDay = Number(employer?.cutoff_day || 25);
  const { balance, coopLoanDeduction, effectiveSalary, period } = await resolveWalletBalance(employee);

  const hasBankDetails = Boolean(
    employee.bank_name &&
    employee.bank_account_number &&
    employee.bank_account_holder
  );

  const canRequest =
    employee.status === "active" &&
    employer?.status === "active" &&
    hasBankDetails;

  const minimumAmount = parseInt(process.env.MINIMUM_WITHDRAWAL_AMOUNT || "50000", 10);
  const rawSalary = Number(employee.base_salary || 0);
  const rawLimit = Number(employee.withdrawal_limit || 0);
  const monthlySalary = Math.round(rawSalary > 0 ? rawSalary : rawLimit);
  const accessCapAmount = balance.effectiveLimit;
  const accessCapPercent = monthlySalary > 0 
    ? Number(((accessCapAmount / monthlySalary) * 100).toFixed(2)) 
    : 50;
  const feePercent = Number(employer.fee_percent ?? 5);

  return c.json({
    data: {
      ...balance.toArray(),
      cutoff_day: cutoffDay,
      pay_period_start: period.start,
      pay_period_end: period.end,
      monthly_salary: monthlySalary,
      coop_loan_deduction: coopLoanDeduction,
      effective_salary: effectiveSalary,
      daily_rate: balance.dailyRate,
      gross_earned: balance.unlocked,
      access_cap_percent: accessCapPercent,
      access_cap_amount: accessCapAmount,
      already_withdrawn: balance.alreadyWithdrawn,
      max_withdrawable: balance.maxWithdrawable,
      fee_percent: feePercent,
      minimum_amount: minimumAmount,
      can_request: canRequest,
    },
  });
});

export default walletRouter;

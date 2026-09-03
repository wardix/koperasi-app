import { Hono } from "hono";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { WalletCalculator } from "../domain/rules/wallet-calculator.js";
import { FeeSchedule } from "../domain/value-objects/fee-schedule.js";

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
  const employer = typeof employee.employer === "string" ? JSON.parse(employee.employer) : employee.employer;
  const cutoffDay = Number(employer.cutoff_day || 25);
  const joinDate = employee.join_date;

  const period = calculator.getPayPeriod(asOf, cutoffDay, joinDate);

  const [row] = await sql`
    SELECT COALESCE(SUM(amount), 0)::BIGINT AS total
    FROM withdrawal_requests
    WHERE employee_id = ${employee.id}
      AND pay_period_start = ${period.start}
      AND status IN ('pending_transfer', 'transferred')
  `;
  const alreadyWithdrawn = Number(row.total);

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

  return {
    period,
    balance: calculator.buildBalance(
      Number(employee.withdrawal_limit),
      period,
      alreadyWithdrawn,
      feeSchedule,
      maxCeiling
    ),
    feeSchedule,
  };
}

walletRouter.get("/balance", authMiddleware, async (c) => {
  const employee = c.get("employee");
  const employer = typeof employee.employer === "string" ? JSON.parse(employee.employer) : employee.employer;

  const { balance } = await resolveWalletBalance(employee);

  const hasBankDetails = Boolean(
    employee.bank_name &&
    employee.bank_account_number &&
    employee.bank_account_holder
  );

  const canRequest =
    employee.status === "active" &&
    employer.status === "active" &&
    hasBankDetails;

  const minimumAmount = parseInt(process.env.MINIMUM_WITHDRAWAL_AMOUNT || "50000", 10);
  const monthlySalary = Math.round(Number(employee.base_salary || employee.withdrawal_limit || 0));
  const accessCapAmount = balance.effectiveLimit;
  const accessCapPercent = monthlySalary > 0 
    ? Number(((accessCapAmount / monthlySalary) * 100).toFixed(2)) 
    : 100;
  const feePercent = Number(employer.fee_percent ?? 5);

  return c.json({
    data: {
      ...balance.toArray(),
      monthly_salary: monthlySalary,
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

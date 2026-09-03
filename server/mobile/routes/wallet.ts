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

  const feeTiers = employer.fee_tiers && employer.fee_tiers.length > 0 ? employer.fee_tiers : defaultFeeSchedule;
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

  return c.json({
    data: {
      ...balance.toArray(),
      minimum_amount: minimumAmount,
      can_request: canRequest,
    },
  });
});

export default walletRouter;

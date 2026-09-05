import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../support/validator.js";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { resolveWalletBalance } from "./wallet.js";
import { WithdrawalException, FeeScheduleException } from "../domain/exceptions.js";
import { formatWithdrawal } from "../support/resources.js";
import { notifyEwaRequest } from "../../services/waNotificationService";

const withdrawalRouter = new Hono();

// GET /api/withdrawals
withdrawalRouter.get("/", authMiddleware, async (c) => {
  const employee = c.get("employee") as any;
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query("per_page") || "20", 10) || 20));
  const offset = (page - 1) * perPage;

  const rows = await sql`
    SELECT * FROM withdrawal_requests
    WHERE employee_id = ${employee.id}
    ORDER BY requested_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  const [countRow] = await sql`
    SELECT COUNT(*)::INT AS total FROM withdrawal_requests WHERE employee_id = ${employee.id}
  `;
  const total = countRow?.total ?? 0;

  return c.json({
    data: rows.map(formatWithdrawal),
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.ceil(total / perPage),
    },
  });
});

// GET /api/withdrawals/:id
withdrawalRouter.get("/:id", authMiddleware, async (c) => {
  const employee = c.get("employee") as any;
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ message: "Not found." }, 404);
  }

  const rows = await sql`
    SELECT * FROM withdrawal_requests
    WHERE id = ${id} AND employee_id = ${employee.id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return c.json({ message: "Not found." }, 404);
  }

  return c.json({ data: formatWithdrawal(rows[0]) });
});

// POST /api/withdrawals
const storeWithdrawalSchema = z.object({
  amount: z.number().int().positive(),
  idempotency_key: z.string().optional(),
});

withdrawalRouter.post("/", authMiddleware, zValidator("json", storeWithdrawalSchema), async (c) => {
  const employee = c.get("employee") as any;
  const employer = typeof employee.employer === "string" ? JSON.parse(employee.employer) : employee.employer;
  const { amount, idempotency_key } = c.req.valid("json" as never) as any;

  // Eligibility check
  if (employer.status !== "active") {
    throw WithdrawalException.employerSuspended();
  }
  if (employee.status === "frozen") {
    throw WithdrawalException.employeeFrozen();
  }
  if (employee.status !== "active") {
    throw WithdrawalException.employeeInactive();
  }
  if (!employee.bank_name || !employee.bank_account_number || !employee.bank_account_holder) {
    throw WithdrawalException.missingBankDetails();
  }

  const minimumAmount = parseInt(process.env.MINIMUM_WITHDRAWAL_AMOUNT || "50000", 10);
  if (amount < minimumAmount) {
    throw WithdrawalException.belowMinimum(amount, minimumAmount);
  }

  const maxOpenRequests = parseInt(process.env.MAX_OPEN_WITHDRAWAL_REQUESTS || "3", 10);

  // Concurrency-safe PostgreSQL Transaction with Row-Locking
  const createdRequest = await sql.begin(async (tx) => {
    // 1. Lock employee record FOR UPDATE
    const lockedEmployees = await tx`
      SELECT * FROM employees WHERE id = ${employee.id} FOR UPDATE
    `;
    if (lockedEmployees.length === 0) {
      throw WithdrawalException.employeeInactive();
    }
    const lockedEmp = lockedEmployees[0];
    lockedEmp.employer = employer;

    // 2. Check idempotency
    if (idempotency_key) {
      const existing = await tx`
        SELECT * FROM withdrawal_requests
        WHERE employee_id = ${lockedEmp.id} AND idempotency_key = ${idempotency_key}
        LIMIT 1
      `;
      if (existing.length > 0) {
        return { request: existing[0], isNew: false };
      }
    }

    // 3. Count open requests
    const [openRow] = await tx`
      SELECT COUNT(*)::INT AS count
      FROM withdrawal_requests
      WHERE employee_id = ${lockedEmp.id} AND status = 'pending_transfer'
    `;
    if ((openRow?.count ?? 0) >= maxOpenRequests) {
      throw WithdrawalException.tooManyOpenRequests(maxOpenRequests);
    }

    // 4. Calculate wallet balance and limit
    const { period, balance, feeSchedule } = await resolveWalletBalance(lockedEmp);

    if (amount > balance.maxWithdrawable) {
      throw WithdrawalException.exceedsAvailable(amount, balance.maxWithdrawable);
    }

    // 5. Price fee band
    let feeTier;
    try {
      feeTier = feeSchedule.tierFor(amount);
    } catch (err) {
      if (err instanceof FeeScheduleException) {
        throw WithdrawalException.feeUnavailable(amount);
      }
      throw err;
    }

    // 6. Insert new withdrawal request
    const rows = await tx`
      INSERT INTO withdrawal_requests (
        employee_id, employer_id, amount, fee, fee_tier_snapshot,
        status, pay_period_start, pay_period_end,
        destination_bank_name, destination_account_number, destination_account_holder,
        requested_at, idempotency_key, created_at, updated_at
      ) VALUES (
        ${lockedEmp.id}, ${lockedEmp.employer_id}, ${amount}, ${feeTier.fee}, ${JSON.stringify(feeTier.toArray())}::jsonb,
        'pending_transfer', ${period.start}, ${period.end},
        ${lockedEmp.bank_name}, ${lockedEmp.bank_account_number}, ${lockedEmp.bank_account_holder},
        NOW(), ${idempotency_key || null}, NOW(), NOW()
      )
      RETURNING *
    `;

    const newRequest = rows[0];

    // Audit log
    const clientIp = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null;
    await tx`
      INSERT INTO audit_logs (
        id, actor, action, entity, entity_id, before, after, ip, created_at
      ) VALUES (
        ${crypto.randomUUID()},
        ${lockedEmp.email || lockedEmp.name || String(lockedEmp.id)},
        'withdrawal.requested',
        'withdrawal_requests',
        ${String(newRequest.id)},
        NULL,
        ${JSON.stringify({
          amount,
          fee: newRequest.fee,
          fee_tier: feeTier.toArray(),
          max_withdrawable_at_request: balance.maxWithdrawable,
          already_withdrawn_at_request: balance.alreadyWithdrawn,
          effective_limit_at_request: balance.effectiveLimit,
          employer_id: lockedEmp.employer_id,
        })}::jsonb,
        ${clientIp},
        NOW()
      )
    `;

    return { request: newRequest, isNew: true };
  });

  if (createdRequest.isNew) {
    notifyEwaRequest({
      memberName: employee?.name || employee?.full_name || 'Karyawan',
      memberCode: employee?.nip || undefined,
      amount: Number(amount),
    });
  }

  return c.json(
    { data: formatWithdrawal(createdRequest.request) },
    createdRequest.isNew ? 201 : 200
  );
});

export default withdrawalRouter;

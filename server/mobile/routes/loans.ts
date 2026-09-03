import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../support/validator.js";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { LoanProviderClient } from "../services/loan-provider.js";
import { LoanCalculator } from "../domain/rules/loan-calculator.js";
import { LoanException } from "../domain/exceptions.js";
import { formatLoanApplication } from "../support/resources.js";

const loanRouter = new Hono();
const provider = new LoanProviderClient();
const calculator = new LoanCalculator();

// GET /api/loans/settings
loanRouter.get("/settings", authMiddleware, async (c) => {
  const terms = await provider.terms();
  return c.json({
    data: {
      annual_interest_rate: terms.annualInterestRate,
      monthly_interest_rate: terms.monthlyInterestRate(),
      method: "anuitas",
    },
  });
});

// GET /api/loans/membership
loanRouter.get("/membership", authMiddleware, async (c) => {
  const employee = c.get("employee");
  const membership = await provider.membership(employee.email, employee.nik);

  const data: Record<string, any> = { ...membership };
  if (!membership.isMember) {
    data.registration_url = process.env.LOAN_REGISTRATION_URL || "https://koperasi.example.com/register";
  }

  return c.json({ data });
});

// POST /api/loans/simulate
const simulateSchema = z.object({
  amount: z.number().int().positive(),
  tenor_months: z.number().int().min(1).max(60),
  first_due_date: z.string().optional(),
});

loanRouter.post("/simulate", authMiddleware, zValidator("json", simulateSchema), async (c) => {
  const { amount, tenor_months, first_due_date } = c.req.valid("json");
  const terms = await provider.terms();
  const quote = calculator.quote(amount, tenor_months, terms, first_due_date);

  return c.json({ data: quote.toArray() });
});

// GET /api/loans
loanRouter.get("/", authMiddleware, async (c) => {
  const employee = c.get("employee");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(c.req.query("per_page") || "20", 10)));
  const offset = (page - 1) * perPage;

  const rows = await sql`
    SELECT * FROM loan_applications
    WHERE employee_id = ${employee.id}
    ORDER BY submitted_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  const [countRow] = await sql`
    SELECT COUNT(*)::INT AS total FROM loan_applications WHERE employee_id = ${employee.id}
  `;
  const total = countRow.total;

  return c.json({
    data: rows.map((r) => formatLoanApplication(r, false)),
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.ceil(total / perPage),
    },
  });
});

// POST /api/loans
const storeLoanSchema = z.object({
  amount: z.number().int().positive(),
  tenor_months: z.number().int().min(1).max(60),
  purpose: z.string().optional(),
  idempotency_key: z.string().optional(),
  first_due_date: z.string().optional(),
});

loanRouter.post("/", authMiddleware, zValidator("json", storeLoanSchema), async (c) => {
  const employee = c.get("employee");
  const { amount, tenor_months, purpose, idempotency_key, first_due_date } = c.req.valid("json");

  // Verify membership
  const membership = await provider.membership(employee.email, employee.nik);
  if (!membership.isMember) {
    throw LoanException.notAMember();
  }
  if (membership.status && membership.status !== "active") {
    throw LoanException.membershipInactive(membership.status);
  }

  // Idempotency check
  if (idempotency_key) {
    const existing = await sql`
      SELECT * FROM loan_applications
      WHERE employee_id = ${employee.id} AND idempotency_key = ${idempotency_key}
      LIMIT 1
    `;
    if (existing.length > 0) {
      return c.json({ data: formatLoanApplication(existing[0], true) }, 200);
    }
  }

  // Price loan quote
  const terms = await provider.terms();
  const quote = calculator.quote(amount, tenor_months, terms, first_due_date);

  const reference = `LN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const submittedAt = new Date().toISOString();

  // Submit upstream to koperasi
  const upstream = await provider.submit(reference, employee, quote, purpose, submittedAt);

  // Save local record
  const [row] = await sql`
    INSERT INTO loan_applications (
      employee_id, reference, external_id, amount, tenor_months, purpose, status,
      annual_interest_rate, monthly_installment, total_interest, total_repayment,
      terms_snapshot, schedule_snapshot, first_due_date, submitted_at, idempotency_key,
      created_at, updated_at
    ) VALUES (
      ${employee.id}, ${reference}, ${upstream.externalId}, ${quote.principal}, ${quote.tenorMonths},
      ${purpose || null}, 'pending_approval', ${quote.annualInterestRate}, ${quote.monthlyInstallment},
      ${quote.totalInterest}, ${quote.totalRepayment}, ${JSON.stringify(quote.toSummaryArray())}::jsonb,
      ${JSON.stringify(quote.schedule.map((s) => s.toArray()))}::jsonb, ${first_due_date || null},
      ${submittedAt}, ${idempotency_key || null}, NOW(), NOW()
    )
    RETURNING *
  `;

  return c.json({ data: formatLoanApplication(row, true) }, 201);
});

// GET /api/loans/:id
loanRouter.get("/:id", authMiddleware, async (c) => {
  const employee = c.get("employee");
  const id = parseInt(c.req.param("id"), 10);

  if (isNaN(id)) {
    return c.json({ message: "Not found." }, 404);
  }

  const rows = await sql`
    SELECT * FROM loan_applications
    WHERE id = ${id} AND employee_id = ${employee.id}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return c.json({ message: "Not found." }, 404);
  }

  return c.json({ data: formatLoanApplication(rows[0], true) });
});

export default loanRouter;

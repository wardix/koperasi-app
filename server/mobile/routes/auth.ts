import { randomBytes, createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../support/validator.js";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { NusanetSsoClient, type SsoIdentity } from "../services/nusanet-sso.js";
import { SsoException } from "../domain/exceptions.js";
import { formatEmployee } from "../support/resources.js";

const authRouter = new Hono();
const sso = new NusanetSsoClient();

async function issueToken(employeeId: number, deviceName: string = "kopnutera-mobile") {
  const plainToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");

  const [row] = await sql`
    INSERT INTO personal_access_tokens (
      tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at
    ) VALUES (
      'App\\Models\\Employee', ${employeeId}, ${deviceName}, ${tokenHash}, '["*"]'::jsonb, NOW(), NOW()
    )
    RETURNING id
  `;

  return `${row.id}|${plainToken}`;
}

async function authenticateIdentity(identity: SsoIdentity, deviceName?: string | null) {
  // Find employee by SSO subject id first, then fallback to email
  let employees = await sql`
    SELECT e.*, row_to_json(emp.*) as employer
    FROM employees e
    JOIN employers emp ON emp.id = e.employer_id
    WHERE e.sso_subject_id = ${identity.subjectId}
    LIMIT 1
  `;

  if (employees.length === 0) {
    employees = await sql`
      SELECT e.*, row_to_json(emp.*) as employer
      FROM employees e
      JOIN employers emp ON emp.id = e.employer_id
      WHERE e.sso_subject_id IS NULL
        AND e.email = ${identity.email}
        AND e.status IN ('active', 'frozen')
      LIMIT 1
    `;
  }

  if (employees.length === 0) {
    throw new SsoException(
      `Email ${identity.email} is not registered on any active employee roster.`,
      "not_on_roster",
      403
    );
  }

  const employee = employees[0];

  if (employee.status !== "active" && employee.status !== "frozen") {
    throw new SsoException("Your account is no longer active.", "employee_inactive", 403);
  }

  // Update employee record
  await sql`
    UPDATE employees
    SET sso_subject_id = ${identity.subjectId},
        last_signed_in_at = NOW(),
        updated_at = NOW()
    WHERE id = ${employee.id}
  `;

  // Issue Sanctum-style access token
  const token = await issueToken(employee.id, deviceName || "kopnutera-mobile");

  // Record audit log
  sql`
    INSERT INTO audit_logs (action, actor_type, actor_id, target_type, target_id, employer_id, metadata, created_at)
    VALUES (
      'employee.signed_in',
      'employee',
      ${employee.id},
      'employee',
      ${employee.id},
      ${employee.employer_id},
      ${JSON.stringify({ device: deviceName })},
      NOW()
    )
  `.catch(() => {});

  return {
    token,
    refresh_token: identity.refreshToken,
    expires_in: identity.expiresIn,
    employee: formatEmployee(employee),
  };
}

const googleSchema = z.object({
  access_token: z.string().min(1),
  device_name: z.string().optional(),
});

authRouter.post("/google", zValidator("json", googleSchema), async (c) => {
  const { access_token, device_name } = c.req.valid("json");
  const identity = await sso.verify(access_token);
  const result = await authenticateIdentity(identity, device_name);
  return c.json(result, 201);
});

const otpRequestSchema = z.object({
  email: z.string().email(),
});

authRouter.post("/otp/request", zValidator("json", otpRequestSchema), async (c) => {
  const { email } = c.req.valid("json");
  await sso.requestEmailOtp(email);
  return c.body(null, 204);
});

const otpVerifySchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1),
  device_name: z.string().optional(),
});

authRouter.post("/otp/verify", zValidator("json", otpVerifySchema), async (c) => {
  const { email, otp, device_name } = c.req.valid("json");
  const identity = await sso.verifyEmailOtp(email, otp);
  const result = await authenticateIdentity(identity, device_name);
  return c.json(result, 201);
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
  device_name: z.string().optional(),
});

authRouter.post("/refresh", zValidator("json", refreshSchema), async (c) => {
  const { refresh_token, device_name } = c.req.valid("json");
  const identity = await sso.refresh(refresh_token);
  const result = await authenticateIdentity(identity, device_name);
  return c.json(result, 200);
});

authRouter.post("/logout", authMiddleware, async (c) => {
  const token = c.get("token");
  if (token?.id) {
    await sql`
      DELETE FROM personal_access_tokens WHERE id = ${token.id}
    `;
  }
  return c.json({ message: "Signed out." });
});

export default authRouter;

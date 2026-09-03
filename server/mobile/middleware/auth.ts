import { createHash } from "node:crypto";
import type { Context, Next } from "hono";
import { sql } from "../db/index.js";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ message: "Unauthenticated." }, 401);
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return c.json({ message: "Unauthenticated." }, 401);
  }

  // Handle Sanctum style `id|plainToken` or plain token
  let tokenPart = rawToken;
  if (rawToken.includes("|")) {
    const parts = rawToken.split("|");
    tokenPart = parts[1] || rawToken;
  }

  const tokenHash = createHash("sha256").update(tokenPart).digest("hex");

  // Query database using Bun SQL
  const tokens = await sql`
    SELECT * FROM personal_access_tokens
    WHERE token = ${tokenHash}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;

  if (tokens.length === 0) {
    return c.json({ message: "Unauthenticated." }, 401);
  }

  const pat = tokens[0];

  // Update last_used_at in background
  sql`
    UPDATE personal_access_tokens
    SET last_used_at = NOW()
    WHERE id = ${pat.id}
  `.catch(() => {});

  // Fetch employee with their employer
  const employees = await sql`
    SELECT 
      e.*,
      json_build_object(
        'id', emp.id,
        'company_name', emp.company_name,
        'slug', emp.slug,
        'cutoff_day', emp.cutoff_day,
        'fee_tiers', emp.fee_tiers,
        'max_withdrawal_amount', emp.max_withdrawal_amount,
        'status', emp.status
      ) AS employer
    FROM employees e
    JOIN employers emp ON emp.id = e.employer_id
    WHERE e.id = ${pat.tokenable_id}
    LIMIT 1
  `;

  if (employees.length === 0) {
    return c.json({ message: "Unauthenticated." }, 401);
  }

  const employee = employees[0];
  c.set("employee", employee);
  c.set("token", pat);

  await next();
}

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { app } from "../../index";
import { sql } from "../../db";

describe("Mobile API Routes mounting under /api", () => {
  let testToken: string;
  let testEmployerId: number;
  let testEmployeeId: number;

  beforeAll(async () => {
    // 1. Setup employer
    const [emp] = await sql`
      INSERT INTO employers (company_name, slug, email_domain, cutoff_day, fee_tiers, max_withdrawal_amount, status)
      VALUES (
        'Test Tech Corp',
        'test-tech',
        'testtech.com',
        25,
        '[{"min": 0, "max": 500000, "fee": 15000}, {"min": 500001, "max": 1000000, "fee": 25000}]'::jsonb,
        5000000,
        'active'
      )
      ON CONFLICT (slug) DO UPDATE SET status = 'active'
      RETURNING id
    `;
    testEmployerId = emp.id;

    // 2. Setup employee
    const [employee] = await sql`
      INSERT INTO employees (
        employer_id, name, email, nik, withdrawal_limit, join_date, bank_name, bank_account_number, bank_account_holder, status
      ) VALUES (
        ${testEmployerId}, 'Budi Mobile', 'budi.mobile@testtech.com', '1234567890123456', 5000000, '2024-01-01', 'Bank Mandiri', '123456789', 'Budi Mobile', 'active'
      )
      ON CONFLICT (employer_id, email) DO UPDATE SET status = 'active'
      RETURNING id
    `;
    testEmployeeId = employee.id;

    // 3. Setup personal access token
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(plainToken).digest("hex");

    const [pat] = await sql`
      INSERT INTO personal_access_tokens (
        tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at
      ) VALUES (
        'App\\Models\\Employee', ${testEmployeeId}, 'test-device', ${tokenHash}, '["*"]'::jsonb, NOW(), NOW()
      )
      RETURNING id
    `;

    testToken = `${pat.id}|${plainToken}`;
  });

  afterAll(async () => {
    try {
      await sql`DELETE FROM personal_access_tokens WHERE tokenable_id = ${testEmployeeId}`;
      await sql`DELETE FROM employees WHERE id = ${testEmployeeId}`;
      await sql`DELETE FROM employers WHERE id = ${testEmployerId}`;
    } catch {
      // ignore cleanup errors
    }
  });

  it("GET /api/loans/settings returns 401 Unauthenticated without Bearer token", async () => {
    const res = await app.request("/api/loans/settings");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toBe("Unauthenticated.");
  });

  it("GET /api/loans/settings returns 200 with Bearer token", async () => {
    const res = await app.request("/api/loans/settings", {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.method).toBe("anuitas");
    expect(body.data.annual_interest_rate).toBeDefined();
  });

  it("GET /api/loans/membership returns 200 with membership status", async () => {
    const res = await app.request("/api/loans/membership", {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(typeof body.data.isMember).toBe("boolean");
  });

  it("POST /api/loans/simulate returns 200 with valid loan calculation", async () => {
    const res = await app.request("/api/loans/simulate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: 10000000,
        tenor_months: 12,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.principal).toBe(10000000);
    expect(body.data.tenor_months).toBe(12);
    expect(body.data.schedule).toBeArray();
    expect(body.data.schedule.length).toBe(12);
  });

  it("GET /api/profile returns 200 with formatted employee profile", async () => {
    const res = await app.request("/api/profile", {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.name).toBe("Budi Mobile");
    expect(body.data.email).toBe("budi.mobile@testtech.com");
    expect(body.data.bank).toBeDefined();
    expect(body.data.bank.name).toBe("Bank Mandiri");
  });

  it("GET /api/wallet/balance returns 200 with wallet balance and fee tiers", async () => {
    const res = await app.request("/api/wallet/balance", {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.withdrawal_limit).toBe(5000000);
    expect(body.data.period_start).toBeDefined();
    expect(body.data.period_end).toBeDefined();
    expect(body.data.fee_tiers).toBeArray();
  });

  it("GET /api/withdrawals returns 200 with paginated list", async () => {
    const res = await app.request("/api/withdrawals", {
      headers: { Authorization: `Bearer ${testToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeArray();
    expect(body.meta).toBeDefined();
  });

  it("POST /api/auth/google returns 400 on invalid payload", async () => {
    const res = await app.request("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

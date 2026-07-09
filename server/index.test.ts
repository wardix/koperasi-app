import { expect, test, describe, afterAll } from "bun:test";
import { unlinkSync, existsSync } from "node:fs";
import server, { _test } from "./index";
import db from "./db";

const secretKey = process.env.JWT_SECRET as string;

import { sign } from "hono/jwt";

describe("API Endpoints", () => {
  let token = "";
  
  test("setup token", async () => {
    token = await sign({ sub: "super-admin-1", email: "test@example.com", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secretKey);
  });

  test("GET /api/v1/stats returns stats", async () => {
    const req = new Request("http://localhost/api/v1/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const raw_body = await res.json();
    const body = raw_body.data;
    expect(body).toHaveProperty("activeMembers");
    expect(body).toHaveProperty("totalSavings");
  });

  test("GET /api/v1/members returns members array", async () => {
    const req = new Request("http://localhost/api/v1/members", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const raw_body = await res.json();
    const body = raw_body.data;
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/v1/loans returns loans array", async () => {
    const req = new Request("http://localhost/api/v1/loans", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const raw_body = await res.json();
    const body = raw_body.data;
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
  
  test("POST /api/v1/login rate limit works", async () => {
    // Generate many requests to hit rate limit
    let status = 200;
    for (let i = 0; i < 7; i++) {
      const req = new Request("http://localhost/api/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1"
        },
        body: JSON.stringify({ email: "admin@example.com", password: "wrong" })
      });
      const res = await server.fetch(req);
      status = res.status;
    }
    // Expect 429 after 5 requests, but we loop 7 times, so final is 429
    expect(status).toBe(429);
  });

  test("RBAC: viewer cannot create member", async () => {
    const viewerToken = await sign({ email: "viewer@example.com", role: "viewer", exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secretKey);
    const req = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${viewerToken}`
      },
      body: JSON.stringify({
        name: "Test Viewer",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 1000
      })
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(403);
  });

  test("PUT /api/v1/members/:id updates member", async () => {
    // 1. First create a member to get an ID
    const createReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Test Update Member",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 1000
      })
    });
    const createRes = await server.fetch(createReq);
    const createBody = await createRes.json();
    const newId = createBody.id;

    // 2. Now update that member
    const updateReq = new Request(`http://localhost/api/v1/members/${newId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Updated Name",
        role: "Ketua",
        status: "Pasif",
        joinDate: "01 Jan 2024",
        simpananPokok: 2000
      })
    });
    const updateRes = await server.fetch(updateReq);
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
  });

  test("PUT /api/v1/members/:id/savings creates a transaction log and updates savings", async () => {
    // 1. Create a member
    const createReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Test Transaction",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 5000
      })
    });
    const createRes = await server.fetch(createReq);
    const newId = (await createRes.json()).id;

    // 2. Add savings
    const saveReq = new Request(`http://localhost/api/v1/members/${newId}/savings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        additionalSavings: 2000
      })
    });
    const saveRes = await server.fetch(saveReq);
    expect(saveRes.status).toBe(200);
    const saveBody = (await saveRes.json()).data;
    expect(saveBody.newTotal).toBe(7000);

    // 3. Get transactions
    const txReq = new Request(`http://localhost/api/v1/members/${newId}/transactions`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const txRes = await server.fetch(txReq);
    expect(txRes.status).toBe(200);
    const txBody = (await txRes.json()).data;
    expect(Array.isArray(txBody)).toBe(true);
    expect(txBody.length).toBe(1);
    expect(txBody[0].amount).toBe(2000);
    expect(txBody[0].type).toBe("setor_sukarela");
    expect(txBody[0].balanceBefore).toBe(5000);
    expect(txBody[0].balanceAfter).toBe(7000);
    expect(txBody[0].createdBy).toBe("test@example.com");
  });
  
  test("PUT /api/v1/members/:id/savings prevents negative balance", async () => {
    // 1. Create member
    const createReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Test Negative Savings",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 100
      })
    });
    const createRes = await server.fetch(createReq);
    const createdMember = (await createRes.json()) as any;
    const id = createdMember.id;

    // 2. Withdraw 500 from simpananPokok (which only has 100)
    const txReq = new Request(`http://localhost/api/v1/members/${id}/savings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        additionalSavings: -500,
        savingsType: "pokok"
      })
    });
    
    const txRes = await server.fetch(txReq);
    expect(txRes.status).toBe(400);
    const body = (await txRes.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toBe("Saldo tidak mencukupi");
  });

  test("POST /api/v1/loans/:id/payments creates payment and GET returns it", async () => {
    // 1. Create a member
    const createReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        name: "Test Loan Member",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 1000
      })
    });
    const createRes = await server.fetch(createReq);
    const memberId = (await createRes.json()).id;

    // 2. Create a loan
    const loanReq = new Request("http://localhost/api/v1/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        memberId,
        name: "Test Loan Member",
        amount: 10000,
        tenor: 10,
        purpose: "Test",
        status: "Disetujui"
      })
    });
    const loanRes = await server.fetch(loanReq);
    const loanId = (await loanRes.json()).id;

    // 3. Make a payment
    const payReq = new Request(`http://localhost/api/v1/loans/${loanId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        amount: 1000,
        method: "Cash"
      })
    });
    const payRes = await server.fetch(payReq);
    expect(payRes.status).toBe(201);
    
    // 4. Get payments
    const getReq = new Request(`http://localhost/api/v1/loans/${loanId}/payments`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const getRes = await server.fetch(getReq);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()).data;
    expect(Array.isArray(getBody)).toBe(true);
    expect(getBody.length).toBe(1);
    expect(getBody[0].amount).toBe(1000);
  });
  
  test("POST /api/v1/loans/:id/payments prevents overpayment", async () => {
    // 1. Create a member
    const createMemReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Test Overpayment",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 1000
      })
    });
    const resMem = await server.fetch(createMemReq);
    const member = (await resMem.json()) as any;

    // 2. Create a loan for 1,000,000
    const createLoanReq = new Request("http://localhost/api/v1/loans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        memberId: member.id,
        name: "Test Overpayment",
        amount: 1000000,
        tenor: 12,
        purpose: "Konsumtif",
        status: "Disetujui"
      })
    });
    const resLoan = await server.fetch(createLoanReq);
    const loan = (await resLoan.json()) as any;

    // 3. Make a payment of 1,500,000 (exceeds 1,000,000)
    const payReq = new Request(`http://localhost/api/v1/loans/${loan.id}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 1500000,
        method: "Transfer"
      })
    });
    const resPay = await server.fetch(payReq);
    expect(resPay.status).toBe(400);
    const bodyPay = (await resPay.json()) as any;
    expect(bodyPay.success).toBe(false);
    expect(bodyPay.message).toBe("Total pembayaran melebihi jumlah pinjaman");
  });

  test("POST /api/v1/loans/:id/payments allows paying up to total amount including interest", async () => {
    // 1. Create a member
    const createMemReq = new Request("http://localhost/api/v1/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        name: "Test Interest Payment",
        role: "Anggota",
        status: "Aktif",
        joinDate: "01 Jan 2024",
        simpananPokok: 1000
      })
    });
    const resMem = await server.fetch(createMemReq);
    const member = (await resMem.json()) as any;

    // 2. Create a loan for 1,000,000 with 12 months tenor.
    // Interest is 1.5% per month, so 1.5% * 12 = 18%. Total amount is 1,180,000.
    const createLoanReq = new Request("http://localhost/api/v1/loans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        memberId: member.id,
        name: "Test Interest Payment",
        amount: 1000000,
        tenor: 12,
        purpose: "Konsumtif",
        status: "Disetujui"
      })
    });
    const resLoan = await server.fetch(createLoanReq);
    const loan = (await resLoan.json()) as any;

    // 3. Make a payment of 1,100,000 (exceeds 1,000,000 principal but is within 1,180,000 total amount)
    const payReq1 = new Request(`http://localhost/api/v1/loans/${loan.id}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 1100000,
        method: "Transfer"
      })
    });
    const resPay1 = await server.fetch(payReq1);
    expect(resPay1.status).toBe(201);

    // 4. Try another payment of 100,000 (making total paid 1,200,000, which exceeds 1,180,000)
    const payReq2 = new Request(`http://localhost/api/v1/loans/${loan.id}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: 100000,
        method: "Transfer"
      })
    });
    const resPay2 = await server.fetch(payReq2);
    expect(resPay2.status).toBe(400);
    const bodyPay2 = (await resPay2.json()) as any;
    expect(bodyPay2.success).toBe(false);
    expect(bodyPay2.message).toBe("Total pembayaran melebihi jumlah pinjaman");
  });

  test("GET /api/v1/shu returns correct SHU calculations and allocations", async () => {
    const shuReq = new Request("http://localhost/api/v1/shu?year=2026", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const res = await server.fetch(shuReq);
    expect(res.status).toBe(200);
    const body = (await res.json()).data as any;
    
    expect(body.year).toBe("2026");
    expect(typeof body.pendapatan).toBe("number");
    expect(typeof body.biayaOperasional).toBe("number");
    expect(typeof body.shuNetto).toBe("number");
    expect(body.distribusi).toBeDefined();
    expect(body.distribusi.anggota).toBe(Math.round(body.shuNetto * 0.40));
    expect(Array.isArray(body.alokasiAnggota)).toBe(true);
  });

  test("rate limit cleanup deletes expired entries", async () => {
    const now = Date.now();
    
    // Add one expired and one non-expired attempt
    await db.run("INSERT INTO rate_limits (ip, count, reset_at) VALUES (?, ?, ?) ON CONFLICT (ip) DO UPDATE SET count = EXCLUDED.count, reset_at = EXCLUDED.reset_at", ["1.1.1.1", 3, now - 1000]); // expired
    await db.run("INSERT INTO rate_limits (ip, count, reset_at) VALUES (?, ?, ?) ON CONFLICT (ip) DO UPDATE SET count = EXCLUDED.count, reset_at = EXCLUDED.reset_at", ["2.2.2.2", 2, now + 60000]); // not expired
    
    await _test.cleanupAttempts();
    
    expect(await db.query("SELECT * FROM rate_limits WHERE ip = ?").get("1.1.1.1")).toBeNull();
    expect(await db.query("SELECT * FROM rate_limits WHERE ip = ?").get("2.2.2.2")).not.toBeNull();
    
    // Clean up
    await db.run("DELETE FROM rate_limits WHERE ip = ?", ["2.2.2.2"]);
  });

  test("GET /health returns health metrics", async () => {
    const req = new Request("http://localhost/health");
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.timestamp).toBeDefined();
  });

  test("token blacklist cleanup deletes expired tokens", async () => {
    const now = Date.now();
    
    // Add one expired and one non-expired token
    await db.run("INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?) ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at", ["expired-token-xyz", now - 1000]); // expired
    await db.run("INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?) ON CONFLICT (token) DO UPDATE SET expires_at = EXCLUDED.expires_at", ["valid-token-abc", now + 60000]); // not expired
    
    await _test.cleanupTokenBlacklist();
    
    expect(await db.query("SELECT * FROM token_blacklist WHERE token = ?").get("expired-token-xyz")).toBeNull();
    expect(await db.query("SELECT * FROM token_blacklist WHERE token = ?").get("valid-token-abc")).not.toBeNull();
    
    // Clean up
    await db.run("DELETE FROM token_blacklist WHERE token = ?", ["valid-token-abc"]);
  });

  test("GET /api/v1/members caps pagination limit at 100", async () => {
    const req = new Request("http://localhost/api/v1/members?limit=1000", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const body = (await res.json()).data as any;
    expect(body.limit).toBe(100);
  });

  test("POST /api/v1/refresh validates user existence and syncs updated role", async () => {
    const adminId = "temp-admin-refresh-test";
    const RequestConstructor = (globalThis as any).NativeRequest || Request;

    try {
      // 1. Create a temporary admin in DB
      await db.prepare("INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)").run(
        adminId,
        "refresh-test@example.com",
        "hashed_password",
        "viewer"
      );

      // 2. Generate a refresh token for this admin with old role "viewer"
      const refreshToken = await sign(
        { sub: adminId, email: "refresh-test@example.com", role: "viewer", exp: Math.floor(Date.now() / 1000) + 60 * 60 },
        secretKey
      );

      // 3. Update the role of the admin in the database to "admin"
      await db.prepare("UPDATE admins SET role = ? WHERE id = ?").run("admin", adminId);

      // 4. Request token refresh
      const req = new RequestConstructor("http://localhost/api/v1/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `refreshToken=${refreshToken}`
        }
      });
      const res = await server.fetch(req);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();

      // Verify the new access token has the updated role "admin"
      const { verify } = require("hono/jwt");
      const newPayload = await verify(body.data.token, secretKey, 'HS256');
      expect(newPayload.role).toBe("admin");

      // 5. Delete the admin from DB (simulate deactivation)
      await db.prepare("DELETE FROM admins WHERE id = ?").run(adminId);

      // 6. Request token refresh again (should fail with 401 since user no longer exists)
      const reqFailed = new RequestConstructor("http://localhost/api/v1/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `refreshToken=${refreshToken}`
        }
      });
      const resFailed = await server.fetch(reqFailed);
      expect(resFailed.status).toBe(401);
      const bodyFailed = (await resFailed.json()) as any;
      expect(bodyFailed.success).toBe(false);
    } finally {
      // Always cleanup database
      await db.prepare("DELETE FROM admins WHERE id = ?").run(adminId);
    }
  });

  test("database migrations are successfully applied", async () => {
    const applied = (await db.query("SELECT name FROM schema_migrations").all() as any[]).map(m => m.name);
    expect(applied).toContain("0001_add_memberId_to_loans");
    expect(applied).toContain("0002_add_simpanan_columns_to_members");
    expect(applied).toContain("0003_convert_currency_to_int");
    expect(applied).toContain("0004_hash_admin_passwords");
  });

  test("PUT /api/v1/settings allows valid keys and rejects invalid ones", async () => {
    // 1. Valid settings update
    const reqValid = new Request("http://localhost/api/v1/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ koperasiName: "Koperasi Baru" })
    });
    const resValid = await server.fetch(reqValid);
    expect(resValid.status).toBe(200);
    const bodyValid = (await resValid.json()) as any;
    expect(bodyValid.success).toBe(true);

    // Verify it updated in DB
    const setting = await db.query("SELECT value FROM settings WHERE key = 'koperasiName'").get() as { value: string };
    expect(setting.value).toBe("Koperasi Baru");

    // 2. Invalid settings update (injection attempt)
    const reqInvalid = new Request("http://localhost/api/v1/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ maliciousKey: "someValue" })
    });
    const resInvalid = await server.fetch(reqInvalid);
    expect(resInvalid.status).toBe(400);
    const bodyInvalid = (await resInvalid.json()) as any;
    expect(bodyInvalid.success).toBe(false);
  });

  test("GET /api/v1/stats caching and invalidation works", async () => {
    // 1. Initial call to populate cache
    const req1 = new Request("http://localhost/api/v1/stats", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const res1 = await server.fetch(req1);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as any;
    const oldSavings = body1.totalSavings;

    // 2. Modify members in DB directly (bypassing Hono routes so cache is not invalidated)
    await db.prepare("UPDATE members SET totalSavings = totalSavings + 1000000000").run();

    try {
      // 3. Second call to stats (should return cached stats, meaning oldSavings is unchanged)
      const res2 = await server.fetch(req1);
      const body2 = (await res2.json()) as any;
      expect(body2.totalSavings).toBe(oldSavings);

      // 4. Update settings via PUT route (which invalidates cache)
      const reqUpdate = new Request("http://localhost/api/v1/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ koperasiName: "Koperasi Terupdate" })
      });
      const resUpdate = await server.fetch(reqUpdate);
      expect(resUpdate.status).toBe(200);

      // 5. Third call to stats (should return fresh stats, meaning totalSavings is updated)
      const res3 = await server.fetch(req1);
      const body3 = (await res3.json()).data as any;
      expect(body3.totalSavings).not.toBe(oldSavings);
    } finally {
      // Clean up members table
      await db.prepare("UPDATE members SET totalSavings = totalSavings - 1000000000").run();
    }
  });

  test("global error handler handles invalid JSON payload", async () => {
    await db.run("DELETE FROM rate_limits");
    const req = new Request("http://localhost/api/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{malformed-json"
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.message).toBe("Invalid JSON payload");
  });

  test("POST /api/v1/auth/google handles SSO flow", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
        const urlStr = input.toString();
        if (urlStr.includes("oauth2.googleapis.com/tokeninfo")) {
          return new Response(JSON.stringify({
            aud: "mock-client-id",
            email_verified: "true",
            email: "dewi@koperasi.com",
            name: "Dewi Lestari",
            picture: "https://example.com/avatar.jpg",
            sub: "google-12345"
          }), { status: 200 });
        }
        return originalFetch(input, init);
      };

      const oldClientId = process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_CLIENT_ID = "mock-client-id";

      const reqEmpty = new Request("http://localhost/api/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const resEmpty = await server.fetch(reqEmpty);
      expect(resEmpty.status).toBe(400);

      const reqValid = new Request("http://localhost/api/v1/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: "mock-google-id-token" })
      });
      const resValid = await server.fetch(reqValid);
      expect([200, 403]).toContain(resValid.status);

      process.env.GOOGLE_CLIENT_ID = oldClientId;
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Roles & Access Management: Admins CRUD protection and functions", async () => {
    const viewerToken = await sign({ email: "viewer@example.com", role: "viewer", exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secretKey);
    const superadminToken = token;

    // 1. GET /api/v1/admins (Viewer - 403)
    const reqGetViewer = new Request("http://localhost/api/v1/admins", {
      headers: { Authorization: `Bearer ${viewerToken}` }
    });
    const resGetViewer = await server.fetch(reqGetViewer);
    expect(resGetViewer.status).toBe(403);

    // 2. GET /api/v1/admins (Superadmin - 200)
    const reqGetSuper = new Request("http://localhost/api/v1/admins", {
      headers: { Authorization: `Bearer ${superadminToken}` }
    });
    const resGetSuper = await server.fetch(reqGetSuper);
    expect(resGetSuper.status).toBe(200);
    const bodyGetSuper = await resGetSuper.json() as any;
    expect(bodyGetSuper.success).toBe(true);
    expect(Array.isArray(bodyGetSuper.data)).toBe(true);

    // 3. POST /api/v1/admins (Create new admin)
    const newAdminEmail = `admin-test-${Date.now()}@example.com`;
    const reqCreate = new Request("http://localhost/api/v1/admins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        email: newAdminEmail,
        password: "password123",
        role: "admin",
        name: "Test Admin Baru"
      })
    });
    const resCreate = await server.fetch(reqCreate);
    expect(resCreate.status).toBe(201);
    const bodyCreate = await resCreate.json() as any;
    expect(bodyCreate.success).toBe(true);
    const createdId = bodyCreate.id;

    // 4. PUT /api/v1/admins/:id (Update role to viewer)
    const reqUpdate = new Request(`http://localhost/api/v1/admins/${createdId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        role: "viewer"
      })
    });
    const resUpdate = await server.fetch(reqUpdate);
    expect(resUpdate.status).toBe(200);

    // 5. Verify self-update prevention
    const selfUpdateReq = new Request(`http://localhost/api/v1/admins/super-admin-1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${superadminToken}`
      },
      body: JSON.stringify({
        role: "viewer"
      })
    });
    const resSelfUpdate = await server.fetch(selfUpdateReq);
    expect(resSelfUpdate.status).toBe(400);

    // 6. Verify self-delete prevention
    const selfDeleteReq = new Request(`http://localhost/api/v1/admins/super-admin-1`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${superadminToken}`
      }
    });
    const resSelfDelete = await server.fetch(selfDeleteReq);
    expect(resSelfDelete.status).toBe(400);

    // 7. DELETE /api/v1/admins/:id (Delete admin)
    const reqDelete = new Request(`http://localhost/api/v1/admins/${createdId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${superadminToken}`
      }
    });
    const resDelete = await server.fetch(reqDelete);
    expect(resDelete.status).toBe(200);
  });

  afterAll(async () => {
    try {
      // Clean up postgres test database tables
      await db.run("TRUNCATE TABLE schema_migrations, admins, members, loans, loan_payments, transactions, settings, token_blacklist, rate_limits CASCADE;");
      db.close();
    } catch (e) { }
  });
});

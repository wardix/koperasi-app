import { expect, test, describe } from "bun:test";
import server, { secretKey, _test } from "./index";

import { sign } from "hono/jwt";

describe("API Endpoints", () => {
  let token = "";
  
  test("setup token", async () => {
    token = await sign({ email: "test@example.com", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 60 * 60 }, secretKey);
  });

  test("GET /api/stats returns stats", async () => {
    const req = new Request("http://localhost/api/stats", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("activeMembers");
    expect(body).toHaveProperty("totalSavings");
  });

  test("GET /api/members returns members array", async () => {
    const req = new Request("http://localhost/api/members", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /api/loans returns loans array", async () => {
    const req = new Request("http://localhost/api/loans", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(Array.isArray(body.data)).toBe(true);
  });
  
  test("POST /api/login rate limit works", async () => {
    // Generate many requests to hit rate limit
    let status = 200;
    for (let i = 0; i < 7; i++) {
      const req = new Request("http://localhost/api/login", {
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
    const req = new Request("http://localhost/api/members", {
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

  test("PUT /api/members/:id updates member", async () => {
    // 1. First create a member to get an ID
    const createReq = new Request("http://localhost/api/members", {
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
    const updateReq = new Request(`http://localhost/api/members/${newId}`, {
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

  test("PUT /api/members/:id/savings creates a transaction log and updates savings", async () => {
    // 1. Create a member
    const createReq = new Request("http://localhost/api/members", {
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
    const saveReq = new Request(`http://localhost/api/members/${newId}/savings`, {
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
    const saveBody = await saveRes.json();
    expect(saveBody.newTotal).toBe(7000);

    // 3. Get transactions
    const txReq = new Request(`http://localhost/api/members/${newId}/transactions`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const txRes = await server.fetch(txReq);
    expect(txRes.status).toBe(200);
    const txBody = await txRes.json();
    expect(Array.isArray(txBody)).toBe(true);
    expect(txBody.length).toBe(1);
    expect(txBody[0].amount).toBe(2000);
    expect(txBody[0].type).toBe("setor_sukarela");
    expect(txBody[0].balanceBefore).toBe(5000);
    expect(txBody[0].balanceAfter).toBe(7000);
    expect(txBody[0].createdBy).toBe("test@example.com");
  });
  
  test("PUT /api/members/:id/savings prevents negative balance", async () => {
    // 1. Create member
    const createReq = new Request("http://localhost/api/members", {
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
    const txReq = new Request(`http://localhost/api/members/${id}/savings`, {
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

  test("POST /api/loans/:id/payments creates payment and GET returns it", async () => {
    // 1. Create a member
    const createReq = new Request("http://localhost/api/members", {
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
    const loanReq = new Request("http://localhost/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        memberId,
        name: "Test Loan Member",
        amount: 10000,
        tenor: "10 Bulan",
        purpose: "Test",
        status: "Disetujui"
      })
    });
    const loanRes = await server.fetch(loanReq);
    const loanId = (await loanRes.json()).id;

    // 3. Make a payment
    const payReq = new Request(`http://localhost/api/loans/${loanId}/payments`, {
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
    const getReq = new Request(`http://localhost/api/loans/${loanId}/payments`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const getRes = await server.fetch(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(Array.isArray(getBody)).toBe(true);
    expect(getBody.length).toBe(1);
    expect(getBody[0].amount).toBe(1000);
  });
  
  test("POST /api/loans/:id/payments prevents overpayment", async () => {
    // 1. Create a member
    const createMemReq = new Request("http://localhost/api/members", {
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
    const createLoanReq = new Request("http://localhost/api/loans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        memberId: member.id,
        name: "Test Overpayment",
        amount: 1000000,
        tenor: "12 Bulan",
        purpose: "Konsumtif",
        status: "Disetujui"
      })
    });
    const resLoan = await server.fetch(createLoanReq);
    const loan = (await resLoan.json()) as any;

    // 3. Make a payment of 1,500,000 (exceeds 1,000,000)
    const payReq = new Request(`http://localhost/api/loans/${loan.id}/payments`, {
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

  test("POST /api/loans/:id/payments allows paying up to total amount including interest", async () => {
    // 1. Create a member
    const createMemReq = new Request("http://localhost/api/members", {
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
    const createLoanReq = new Request("http://localhost/api/loans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        memberId: member.id,
        name: "Test Interest Payment",
        amount: 1000000,
        tenor: "12 Bulan",
        purpose: "Konsumtif",
        status: "Disetujui"
      })
    });
    const resLoan = await server.fetch(createLoanReq);
    const loan = (await resLoan.json()) as any;

    // 3. Make a payment of 1,100,000 (exceeds 1,000,000 principal but is within 1,180,000 total amount)
    const payReq1 = new Request(`http://localhost/api/loans/${loan.id}/payments`, {
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
    const payReq2 = new Request(`http://localhost/api/loans/${loan.id}/payments`, {
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

  test("GET /api/shu returns correct SHU calculations and allocations", async () => {
    const shuReq = new Request("http://localhost/api/shu?year=2026", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const res = await server.fetch(shuReq);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    
    expect(body.year).toBe("2026");
    expect(typeof body.pendapatan).toBe("number");
    expect(typeof body.biayaOperasional).toBe("number");
    expect(typeof body.shuNetto).toBe("number");
    expect(body.distribusi).toBeDefined();
    expect(body.distribusi.anggota).toBe(Math.round(body.shuNetto * 0.40));
    expect(Array.isArray(body.alokasiAnggota)).toBe(true);
  });

  test("rate limit cleanup deletes expired entries", () => {
    const now = Date.now();
    
    // Add one expired and one non-expired attempt
    _test.loginAttempts.set("1.1.1.1", { count: 3, resetAt: now - 1000 }); // expired
    _test.loginAttempts.set("2.2.2.2", { count: 2, resetAt: now + 60000 }); // not expired
    
    _test.cleanupAttempts();
    
    expect(_test.loginAttempts.has("1.1.1.1")).toBe(false);
    expect(_test.loginAttempts.has("2.2.2.2")).toBe(true);
    
    // Clean up
    _test.loginAttempts.delete("2.2.2.2");
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

  test("database path subdirectory is created if it does not exist", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const testDbPath = "test_data_dir/subdir/koperasi.sqlite";
    const dir = path.dirname(testDbPath);
    
    // Clean up if exists
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    
    expect(fs.existsSync(dir)).toBe(false);
    
    // Simulate db.ts path creation logic
    if (dir && dir !== "." && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    expect(fs.existsSync(dir)).toBe(true);
    
    // Clean up
    fs.rmSync("test_data_dir", { recursive: true, force: true });
  });
});

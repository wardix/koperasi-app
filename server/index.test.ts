import { expect, test, describe } from "bun:test";
import server from "./index";

import { sign } from "hono/jwt";

describe("API Endpoints", () => {
  let token = "";
  
  test("setup token", async () => {
    token = await sign({ email: "test@example.com", exp: Math.floor(Date.now() / 1000) + 60 * 60 }, "koperasi-super-secret-key-2026");
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
    expect(status).toBe(429);
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
});

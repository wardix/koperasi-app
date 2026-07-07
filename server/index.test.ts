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
        totalSavings: 1000
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
        totalSavings: 2000
      })
    });
    const updateRes = await server.fetch(updateReq);
    expect(updateRes.status).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.success).toBe(true);
  });
});

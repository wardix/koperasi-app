import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { app } from "../index";
import db from "../db";
import { sign } from "hono/jwt";

describe("Reports API", () => {
  let token: string;

  beforeAll(async () => {
    token = await sign(
      {
        id: "admin-id",
        email: "admin@test.com",
        role: "Super Admin",
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
        permissions: ["read:reports"],
      },
      process.env.JWT_SECRET || "test-secret-key"
    );
  });

  test("GET /api/reports/cashflow-statement works with date filters", async () => {
    // Tests that parameter bindings for the UNION query are aligned correctly
    // Without the fix, Postgres would throw: "bind message supplies X parameters, but prepared statement requires Y"
    const req = new Request("http://localhost/api/reports/cashflow-statement?startDate=2026-01-01&endDate=2026-12-31", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
  
  test("GET /api/reports/cashflow-statement works without date filters", async () => {
    const req = new Request("http://localhost/api/reports/cashflow-statement", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});

import { expect, test, describe, beforeAll } from "bun:test";
import server from "../index";
import { secretKey } from "../middleware";
import { sign } from "hono/jwt";

describe("Reports API", () => {
  let token: string;

  beforeAll(async () => {
    token = await sign(
      {
        email: "admin@example.com",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  test("GET /api/v1/reports/cashflow-statement works with date filters", async () => {
    // Tests that parameter bindings for the UNION query are aligned correctly
    const req = new Request("http://localhost/api/v1/reports/cashflow-statement?startDate=2026-01-01&endDate=2026-12-31", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("GET /api/v1/reports/cashflow-statement works with startDate filter only", async () => {
    const req = new Request("http://localhost/api/v1/reports/cashflow-statement?startDate=2026-01-01", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("GET /api/v1/reports/cashflow-statement works with endDate filter only", async () => {
    const req = new Request("http://localhost/api/v1/reports/cashflow-statement?endDate=2026-12-31", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
  
  test("GET /api/v1/reports/cashflow-statement works without date filters", async () => {
    const req = new Request("http://localhost/api/v1/reports/cashflow-statement", {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const res = await server.fetch(req);
    expect(res.status).toBe(200);
    
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});

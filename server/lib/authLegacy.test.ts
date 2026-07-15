import { expect, test, describe } from "bun:test";
import server from "../index";

describe("legacy auth path aliases", () => {
  test("POST /api/v1/login forwards to canonical path with Deprecation header", async () => {
    const req = new Request("http://localhost/api/v1/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-admin@example.com", password: "wrong" }),
    });

    const res = await server.fetch(req);
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toContain("/api/v1/auth/login");
    expect(res.status).toBe(401);
  });

  test("GET /api/v1/verify forwards with Deprecation header", async () => {
    const req = new Request("http://localhost/api/v1/verify");
    const res = await server.fetch(req);
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toContain("/api/v1/auth/verify");
    expect(res.status).toBe(401);
  });
});
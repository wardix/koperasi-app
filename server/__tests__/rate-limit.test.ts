import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("API Rate Limiting (Issue #204)", () => {
  beforeAll(async () => {
    // Ensure migrations are applied
    await import("../db");
  });

  beforeEach(async () => {
    // Isolate buckets so suite order / shared IPs do not leak between cases
    await db.run("DELETE FROM rate_limits");
  });

  afterAll(async () => {
    try {
      // Clean up rate_limits table
      await db.run("DELETE FROM rate_limits");
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  // ===========================================================================
  // Login Rate Limit Tests
  // ===========================================================================

  describe("Login Rate Limit", () => {
    test("login rate limit triggers after threshold (5 requests in 15 min)", async () => {
      const ip = "test-ip-login-limit";

      // Make 5 requests (should all succeed)
      for (let i = 0; i < 5; i++) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
          })
        );
        expect(res.status).not.toBe(429); // Should not be rate limited yet
      }

      // 6th request should be rate limited
      const res = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
        })
      );
      expect(res.status).toBe(429);
    });

    test("different IPs are tracked separately", async () => {
      const ip1 = "test-ip-1";
      const ip2 = "test-ip-2";

      // Make 5 requests from IP1 (should succeed)
      for (let i = 0; i < 5; i++) {
        await server.fetch(
          new Request("http://localhost/api/v1/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip1,
            },
            body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
          })
        );
      }

      // IP2 should still be able to make requests (not rate limited)
      const res = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip2,
          },
          body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
        })
      );
      expect(res.status).not.toBe(429); // IP2 should not be rate limited
    });

    test("RATE_LIMIT_ENABLED=false disables all limiting", async () => {
      const originalEnv = process.env.RATE_LIMIT_ENABLED;
      process.env.RATE_LIMIT_ENABLED = "false";

      try {
        const ip = "test-ip-disabled";

        // Make 10 requests (should all succeed even though limit is 5)
        for (let i = 0; i < 10; i++) {
          const res = await server.fetch(
            new Request("http://localhost/api/v1/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-forwarded-for": ip,
              },
              body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
            })
          );
          expect(res.status).not.toBe(429); // Should not be rate limited when disabled
        }
      } finally {
        if (originalEnv) {
          process.env.RATE_LIMIT_ENABLED = originalEnv;
        } else {
          delete process.env.RATE_LIMIT_ENABLED;
        }
      }
    });

    test("BYPASS_RATE_LIMIT=true bypasses all limiting", async () => {
      const originalBypass = process.env.BYPASS_RATE_LIMIT;
      process.env.BYPASS_RATE_LIMIT = "true";

      try {
        const ip = "test-ip-bypass";

        // Make 10 requests (should all succeed even though limit is 5)
        for (let i = 0; i < 10; i++) {
          const res = await server.fetch(
            new Request("http://localhost/api/v1/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-forwarded-for": ip,
              },
              body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
            })
          );
          expect(res.status).not.toBe(429); // Should not be rate limited when bypassed
        }
      } finally {
        if (originalBypass) {
          process.env.BYPASS_RATE_LIMIT = originalBypass;
        } else {
          delete process.env.BYPASS_RATE_LIMIT;
        }
      }
    });
  });

  // ===========================================================================
  // SSO Rate Limit Tests
  // ===========================================================================

  describe("SSO Rate Limit", () => {
    test("SSO rate limit triggers independently from login", async () => {
      const ip = "test-ip-sso";

      // Make 5 requests to SSO endpoint (should succeed)
      for (let i = 0; i < 5; i++) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ credential: "test-credential" }),
          })
        );
        expect(res.status).not.toBe(429); // Should not be rate limited yet
      }

      // 6th request should be rate limited
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/google", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ credential: "test-credential" }),
        })
      );
      expect(res.status).toBe(429); // Should be rate limited
    });

    test("SSO and login have independent counters", async () => {
      const ip = "test-ip-independent";

      // Exhaust SSO quota (5 requests)
      for (let i = 0; i < 5; i++) {
        await server.fetch(
          new Request("http://localhost/api/v1/auth/google", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ credential: "test-credential" }),
          })
        );
      }

      // Login should still work (separate counter) - 6th request to login should be rate limited
      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
        })
      );

      // Login should NOT be rate limited (SSO quota exhausted doesn't affect login)
      expect(loginRes.status).not.toBe(429);

      // Now exhaust login quota (5 requests total including the one above)
      for (let i = 0; i < 4; i++) {
        await server.fetch(
          new Request("http://localhost/api/v1/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
          })
        );
      }

      // Now both should be rate limited
      const loginRes2 = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
        })
      );
      expect(loginRes2.status).toBe(429); // Login should be rate limited now

      const ssoRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/google", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": ip,
          },
          body: JSON.stringify({ credential: "test-credential" }),
        })
      );
      expect(ssoRes.status).toBe(429); // SSO should be rate limited (5/5 used)
    });
  });

  // ===========================================================================
  // Refresh Rate Limit Tests
  // ===========================================================================

  describe("Refresh Rate Limit", () => {
    test("refresh uses different window (30 req/hour)", async () => {
      const ip = "test-ip-refresh";

      // Make 30 requests to refresh endpoint (should all succeed)
      for (let i = 0; i < 30; i++) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/refresh", {
            method: "POST",
            headers: {
              Cookie: `refreshToken=test-token-${i}`,
              "x-forwarded-for": ip,
            },
          })
        );
        // Some may fail due to invalid token, but none should be 429 yet
        expect(res.status).not.toBe(429);
      }

      // 31st request should be rate limited
      const res = await server.fetch(
        new Request("http://localhost/api/v1/refresh", {
          method: "POST",
          headers: {
            Cookie: `refreshToken=test-token-31`,
            "x-forwarded-for": ip,
          },
        })
      );
      expect(res.status).toBe(429); // Should be rate limited (30/hour limit)
    });

    test("refresh rate limit is independent from login/SSO", async () => {
      const ip = "test-ip-refresh-independent";

      // Make 5 requests to login (uses up login quota)
      for (let i = 0; i < 5; i++) {
        await server.fetch(
          new Request("http://localhost/api/v1/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": ip,
            },
            body: JSON.stringify({ email: "test@example.com", password: "wrong" }),
          })
        );
      }

      // Refresh should still work (different limit window)
      const res = await server.fetch(
        new Request("http://localhost/api/v1/refresh", {
          method: "POST",
          headers: {
            Cookie: `refreshToken=test-token`,
            "x-forwarded-for": ip,
          },
        })
      );
      // May fail due to invalid token, but should NOT be 429 (different limit)
      expect(res.status).not.toBe(429);
    });
  });

  // ===========================================================================
  // Global API Rate Limit Tests
  // ===========================================================================

  describe("Global API Rate Limit", () => {
    test("GLOBAL_API_RATE_LIMIT=false disables global rate limiting", async () => {
      const originalEnv = process.env.GLOBAL_API_RATE_LIMIT;
      process.env.GLOBAL_API_RATE_LIMIT = "false";

      try {
        // Make requests to a non-auth endpoint (should not be rate limited by global limiter)
        for (let i = 0; i < 10; i++) {
          const res = await server.fetch(
            new Request("http://localhost/api/v1/stats", {
              headers: { Authorization: `Bearer test-token-${i}` },
            })
          );
          // May fail due to invalid token, but should NOT be 429 from global limiter
          expect(res.status).not.toBe(429);
        }
      } finally {
        if (originalEnv) {
          process.env.GLOBAL_API_RATE_LIMIT = originalEnv;
        } else {
          delete process.env.GLOBAL_API_RATE_LIMIT;
        }
      }
    });

    test("GLOBAL_API_RATE_LIMIT=true enables global rate limiting", async () => {
      const originalEnv = process.env.GLOBAL_API_RATE_LIMIT;
      process.env.GLOBAL_API_RATE_LIMIT = "true";
      const ip = "test-ip-global-api";
      const token = await sign(
        { sub: "1", email: "test@example.com", role: "superadmin", exp: Math.floor(Date.now() / 1000) + 3600, jti: crypto.randomUUID() },
        secretKey
      );

      try {
        // Make 61 requests to a non-auth endpoint (should be limited at 60/min)
        for (let i = 0; i < 60; i++) {
          await server.fetch(
            new Request("http://localhost/api/v1/stats", {
              headers: {
                Authorization: `Bearer ${token}`,
                "x-forwarded-for": ip,
              },
            })
          );
        }

        // 61st request should be rate limited by global limiter
        const res = await server.fetch(
          new Request("http://localhost/api/v1/stats", {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-forwarded-for": ip,
            },
          })
        );
        expect(res.status).toBe(429); // Should be rate limited by global limiter
      } finally {
        if (originalEnv) {
          process.env.GLOBAL_API_RATE_LIMIT = originalEnv;
        } else {
          delete process.env.GLOBAL_API_RATE_LIMIT;
        }
      }
    });
  });

  // ===========================================================================
  // Atomic Upsert Tests (Race Condition Prevention)
  // ===========================================================================

  describe("Atomic Rate Limit Check", () => {
    test("checkRateLimit uses atomic upsert (no race condition)", async () => {
      const { checkRateLimit } = await import("../middleware");

      const key = "test-atomic-key";
      const limit = 5;
      const windowMs = 15 * 60 * 1000; // 15 minutes

      // Make concurrent requests (simulating race condition)
      const promises = Array.from({ length: 10 }, (_, i) =>
        checkRateLimit(key, limit, windowMs)
      );

      const results = await Promise.all(promises);

      // Exactly `limit` requests should succeed, rest should be rate limited
      const allowedCount = results.filter((r) => r === true).length;
      expect(allowedCount).toBe(limit); // Only first 5 should be allowed
    });
  });
});

import { expect, test, describe } from "bun:test";
import server from "../index";
import db from "../db";

describe("API Rate Limiting (Issue #204)", () => {
  beforeAll(async () => {
    // Ensure migrations are applied
    await import("../db");
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

    test("SSO and login share same IP counter (both use 5/15min)", async () => {
      const ip = "test-ip-shared";

      // Make 3 requests to login
      for (let i = 0; i < 3; i++) {
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

      // Make 2 requests to SSO (total should be 5)
      for (let i = 0; i < 2; i++) {
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

      // Next request (6th) to either endpoint should be rate limited
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
      expect(res.status).toBe(429); // Should be rate limited (5 total requests used)
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

      try {
        // Make 61 requests to a non-auth endpoint (should be limited at 60/min)
        for (let i = 0; i < 60; i++) {
          await server.fetch(
            new Request("http://localhost/api/v1/stats", {
              headers: { Authorization: `Bearer test-token-${i}` },
            })
          );
        }

        // 61st request should be rate limited by global limiter
        const res = await server.fetch(
          new Request("http://localhost/api/v1/stats", {
            headers: { Authorization: "Bearer test-token-61" },
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

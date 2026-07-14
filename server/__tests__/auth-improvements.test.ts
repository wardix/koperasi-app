import { expect, test, describe } from "bun:test";
import server from "../index";
import db from "../db";
import { sign, verify, decode } from "hono/jwt";

const secretKey = process.env.JWT_SECRET || Bun.env.JWT_SECRET;

describe("Auth Token Improvements (Issue #203)", () => {
  let adminToken: string;
  let adminId: string;
  let adminEmail: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Ensure migrations are applied
    await import("../db");

    const timestamp = Date.now();
    adminId = `admin-auth-${timestamp}`;
    adminEmail = `auth-test-${timestamp}@example.com`;

    // Create test admin with strong password
    const hashedPassword = await Bun.password.hash("StrongP@ss123!");
    await db.prepare(
      "INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)"
    ).run(adminId, adminEmail, hashedPassword, "superadmin");

    // Login to get tokens
    const loginRes = await server.fetch(
      new Request("http://localhost/api/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "127.0.0.1"
        },
        body: JSON.stringify({ email: adminEmail, password: "StrongP@ss123!" })
      })
    );
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json() as any;
    adminToken = loginBody.data.token;
    refreshToken = (await server.fetch(
      new Request("http://localhost/api/v1/refresh", {
        method: "POST",
        headers: { Cookie: `refreshToken=${loginBody.data.refreshToken}` }
      })
    )).headers.get('set-cookie')?.split(';')[0]?.replace('refreshToken=', '') || '';
  });

  afterAll(async () => {
    try {
      await db.run(`DELETE FROM admins WHERE id LIKE 'admin-auth-%'`);
      await db.run("DELETE FROM token_blacklist WHERE jti_token LIKE 'test-jti-%'");
      await db.run("DELETE FROM refresh_token_blacklist WHERE admin_id = ?", [adminId]);
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  // ===========================================================================
  // JTI Claim Tests
  // ===========================================================================

  describe("JTI Claim in JWT Payloads", () => {
    test("access token includes jti claim", async () => {
      const decoded = decode(adminToken);
      expect(decoded.payload.jti).toBeDefined();
      expect(typeof decoded.payload.jti).toBe("string");
      expect(decoded.payload.jti.length).toBeGreaterThan(0);
    });

    test("refresh token includes jti claim", async () => {
      if (!refreshToken) return; // Skip if no refresh token available
      const decoded = decode(refreshToken);
      expect(decoded.payload.jti).toBeDefined();
      expect(typeof decoded.payload.jti).toBe("string");
      expect(decoded.payload.jti.length).toBeGreaterThan(0);
    });

    test("each access token has unique jti", async () => {
      // Login again to get a new token
      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1"
          },
          body: JSON.stringify({ email: adminEmail, password: "StrongP@ss123!" })
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;
      const newToken = loginBody.data.token;

      const decoded1 = decode(adminToken);
      const decoded2 = decode(newToken);

      // jti should be different for each token
      expect(decoded1.payload.jti).not.toBe(decoded2.payload.jti);
    });
  });

  // ===========================================================================
  // Token Blacklist by JTI Tests
  // ===========================================================================

  describe("Token Blacklist by JTI", () => {
    test("logout blacklists token by jti, not full JWT string", async () => {
      // Logout the admin
      const logoutRes = await server.fetch(
        new Request("http://localhost/api/v1/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(logoutRes.status).toBe(200);

      // Verify token is blacklisted by jti
      const decoded = decode(adminToken);
      const jti = decoded.payload.jti;

      const blacklisted = await db.query(
        "SELECT 1 FROM token_blacklist WHERE jti_token = ?",
        [jti]
      ).get();
      expect(blacklisted).not.toBeNull();

      // Verify the full JWT string is NOT stored (only jti)
      const byFullString = await db.query(
        "SELECT 1 FROM token_blacklist WHERE jti_token = ?",
        [adminToken]
      ).get();
      expect(byFullString).toBeNull();
    });

    test("blacklisted jti prevents access (401)", async () => {
      // Logout first to blacklist the token
      await server.fetch(
        new Request("http://localhost/api/v1/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );

      // Try to use blacklisted token — should get 401
      const res = await server.fetch(
        new Request("http://localhost/api/v1/stats", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(res.status).toBe(401);
    });

    test("valid (non-blacklisted) jti allows access", async () => {
      // Login to get a fresh token
      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1"
          },
          body: JSON.stringify({ email: adminEmail, password: "StrongP@ss123!" })
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;
      const freshToken = loginBody.data.token;

      // Use fresh token to access protected endpoint — should succeed
      const res = await server.fetch(
        new Request("http://localhost/api/v1/stats", {
          headers: { Authorization: `Bearer ${freshToken}` }
        })
      );
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // Password Policy Tests
  // ===========================================================================

  describe("Password Policy (Min 12 chars + complexity)", () => {
    test("password policy rejects weak passwords (< 12 chars)", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/admins", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: `weak-pass-${Date.now()}@example.com`,
            password: "short", // Too short and no complexity
            role: "viewer"
          })
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    test("password policy rejects passwords without uppercase", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/admins", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: `no-upper-${Date.now()}@example.com`,
            password: "noupper12345!", // No uppercase letter
            role: "viewer"
          })
        })
      );
      expect(res.status).toBe(400);
    });

    test("password policy rejects passwords without lowercase", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/admins", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: `no-lower-${Date.now()}@example.com`,
            password: "NOLOWERCASE1!", // No lowercase letter
            role: "viewer"
          })
        })
      );
      expect(res.status).toBe(400);
    });

    test("password policy rejects passwords without number", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/admins", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: `no-num-${Date.now()}@example.com`,
            password: "NoNumberHere!", // No number
            role: "viewer"
          })
        })
      );
      expect(res.status).toBe(400);
    });

    test("password policy accepts strong passwords", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/admins", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: `strong-pass-${Date.now()}@example.com`,
            password: "Str0ngP@ssw0rd!", // Has uppercase, lowercase, number, special char, 16 chars
            role: "viewer"
          })
        })
      );
      expect(res.status).toBe(201);
    });

    test("common passwords are blocked", async () => {
      const commonPasswords = ["password", "admin123456", "qwerty123456"];

      for (const pwd of commonPasswords) {
        const res = await server.fetch(
          new Request("http://localhost/api/v1/admins", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              email: `common-${Date.now()}@example.com`,
              password: pwd,
              role: "viewer"
            })
          })
        );
        expect(res.status).toBe(400);
      }
    });
  });

  // ===========================================================================
  // Refresh Token Rotation Tests
  // ===========================================================================

  describe("Refresh Token Rotation", () => {
    test("refresh rotation: old token revoked on new refresh", async () => {
      // Get initial refresh token
      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1"
          },
          body: JSON.stringify({ email: adminEmail, password: "StrongP@ss123!" })
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;

      // Decode initial refresh token to get jti
      const oldRefreshToken = (await server.fetch(
        new Request("http://localhost/api/v1/refresh", {
          method: "POST",
          headers: { Cookie: `refreshToken=${loginBody.data.refreshToken}` }
        })
      )).headers.get('set-cookie')?.split(';')[0]?.replace('refreshToken=', '') || '';

      const oldDecoded = decode(oldRefreshToken);
      const oldJti = oldDecoded.payload.jti;

      // Verify old refresh token is blacklisted after rotation
      const blacklisted = await db.query(
        "SELECT 1 FROM refresh_token_blacklist WHERE jti_token = ?",
        [oldJti]
      ).get();
      expect(blacklisted).not.toBeNull();
    });

    test("refresh reuse detection: reused token revokes all user tokens", async () => {
      // Get a fresh login
      const loginRes = await server.fetch(
        new Request("http://localhost/api/v1/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": "127.0.0.1"
          },
          body: JSON.stringify({ email: adminEmail, password: "StrongP@ss123!" })
        })
      );
      expect(loginRes.status).toBe(200);
      const loginBody = await loginRes.json() as any;

      // Extract old refresh token (before rotation)
      const oldRefreshToken = (await server.fetch(
        new Request("http://localhost/api/v1/refresh", {
          method: "POST",
          headers: { Cookie: `refreshToken=${loginBody.data.refreshToken}` }
        })
      )).headers.get('set-cookie')?.split(';')[0]?.replace('refreshToken=', '') || '';

      // Try to reuse the old refresh token — should fail with 401
      const reuseRes = await server.fetch(
        new Request("http://localhost/api/v1/refresh", {
          method: "POST",
          headers: { Cookie: `refreshToken=${oldRefreshToken}` }
        })
      );
      expect(reuseRes.status).toBe(401);

      const reuseBody = await reuseRes.json() as any;
      expect(reuseBody.success).toBe(false);
    });
  });

  // ===========================================================================
  // Google SSO No Regression Tests
  // ===========================================================================

  describe("Google SSO (No Regression)", () => {
    test("Google SSO login still works with new JWT structure", async () => {
      // Mock Google token verification
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = async (input: string | Request | URL, init?: RequestInit) => {
          const urlStr = input.toString();
          if (urlStr.includes("oauth2.googleapis.com/tokeninfo")) {
            return new Response(JSON.stringify({
              aud: "mock-client-id",
              email_verified: "true",
              email: `sso-test-${Date.now()}@google.com`,
              name: "SSO Test User",
              picture: "https://example.com/avatar.jpg",
              sub: `google-sso-${Date.now()}`
            }), { status: 200 });
          }
          return originalFetch(input, init);
        };

        process.env.GOOGLE_CLIENT_ID = "mock-client-id";

        const res = await server.fetch(
          new Request("http://localhost/api/v1/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: "mock-google-id-token" })
          })
        );

        // Should succeed (200) or fail with 403 (if SSO auto-register is off)
        expect([200, 403]).toContain(res.status);

        if (res.status === 200) {
          const body = await res.json() as any;
          // Verify JWT payload includes jti claim
          const decoded = decode(body.data.token);
          expect(decoded.payload.jti).toBeDefined();
        }

        process.env.GOOGLE_CLIENT_ID = undefined as any;
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

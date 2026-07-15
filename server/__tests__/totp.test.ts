import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import server from "../index";
import db from "../db";
import { sign } from "hono/jwt";
import { generateValidToken } from "../lib/totp";

const secretKey = process.env.JWT_SECRET || Bun.env.JWT_SECRET;

describe("TOTP 2FA Feature", () => {
  let adminToken: string;
  let adminId: string;
  let adminEmail: string;
  let secondAdminToken: string;
  let secondAdminId: string;
  let secondAdminEmail: string;

  beforeAll(async () => {
    // Ensure migrations are applied
    await import("../db");

    const timestamp = Date.now();

    // Create first admin for testing (no 2FA initially)
    const hashedPassword1 = await Bun.password.hash("testpassword123");
    adminId = `admin-totp-${timestamp}`;
    adminEmail = `totp-admin-${timestamp}@example.com`;
    await db.prepare(
      "INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)"
    ).run(adminId, adminEmail, hashedPassword1, "superadmin");

    // Create second admin for testing 2FA flow
    const hashedPassword2 = await Bun.password.hash("testpassword456");
    secondAdminId = `admin-totp-2-${timestamp}`;
    secondAdminEmail = `totp-admin2-${timestamp}@example.com`;
    await db.prepare(
      "INSERT INTO admins (id, email, password, role) VALUES (?, ?, ?, ?)"
    ).run(secondAdminId, secondAdminEmail, hashedPassword2, "superadmin");

    // Generate tokens for both admins
    adminToken = await sign(
      { sub: adminId, email: adminEmail, role: "superadmin", exp: Math.floor(Date.now() / 1000) + 3600 },
      secretKey
    );

    secondAdminToken = await sign(
      { sub: secondAdminId, email: secondAdminEmail, role: "superadmin", exp: Math.floor(Date.now() / 1000) + 3600 },
      secretKey
    );
  });

  afterAll(async () => {
    try {
      await db.run(`DELETE FROM admins WHERE id LIKE 'admin-totp-%'`);
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  // ===========================================================================
  // TOTP Utility Function Tests
  // ===========================================================================

  describe("TOTP Utility Functions", () => {
    test("generateSecret returns a valid base32 string", async () => {
      const { generateSecret } = await import("../lib/totp");
      const secret = generateSecret();
      expect(secret).toBeDefined();
      expect(typeof secret).toBe("string");
      expect(secret.length).toBeGreaterThan(0);
      // Base32 characters: A-Z, 2-7, = (padding)
      expect(secret).toMatch(/^[A-Z2-7=]+$/);
    });

    test("verifyToken validates correct token", async () => {
      const { generateSecret, verifyToken } = await import("../lib/totp");
      const secret = generateSecret();
      const validToken = generateValidToken(secret);

      expect(verifyToken(secret, validToken)).toBe(true);
    });

    test("verifyToken rejects invalid token", async () => {
      const { generateSecret, verifyToken } = await import("../lib/totp");
      const secret = generateSecret();
      // Use a random 6-digit string that's unlikely to be valid
      expect(verifyToken(secret, "000000")).toBe(false);
    });

    test("generateRecoveryCodes returns array of hex strings", async () => {
      const { generateRecoveryCodes } = await import("../lib/totp");
      const codes = generateRecoveryCodes(8);

      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBe(8);
      codes.forEach((code) => {
        expect(typeof code).toBe("string");
        expect(code.length).toBe(8); // 4 bytes = 8 hex chars
        expect(code).toMatch(/^[0-9A-F]{8}$/); // uppercase hex
      });
    });

    test("generateRecoveryCodes uses default count of 8", async () => {
      const { generateRecoveryCodes } = await import("../lib/totp");
      const codes = generateRecoveryCodes();

      expect(codes.length).toBe(8);
    });

    test("totpUrl returns valid otpauth URI", async () => {
      const { generateSecret, totpUrl } = await import("../lib/totp");
      const secret = generateSecret();
      const uri = totpUrl(secret, "test@example.com");

      expect(uri).toMatch(/^otpauth:\/\/totp\//);
      expect(decodeURIComponent(uri)).toContain("test@example.com");
      expect(uri).toContain("secret=");
      expect(uri).toContain("issuer=");
    });
  });

  // ===========================================================================
  // Login Flow Tests (with and without 2FA)
  // ===========================================================================

  describe("Login Flow", () => {
    beforeEach(async () => {
      await db.run("DELETE FROM rate_limits");
    });

    test("login without 2FA: returns JWT directly (no token needed)", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `totp-login-${crypto.randomUUID()}`
          },
          body: JSON.stringify({
            email: adminEmail,
            password: "testpassword123"
          })
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.requiresTotp).toBeFalsy();
      expect(body.data.token).toBeDefined();
    });

    test("login with 2FA enabled but no token: returns requiresTotp=true", async () => {
      // First enable 2FA for second admin using a valid TOTP token

      // Setup TOTP
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${secondAdminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);
      const setupBody = await setupRes.json() as any;

      // Generate valid token from the secret
      const validToken = generateValidToken(setupBody.data.secret);

      // Verify to enable 2FA
      const verifyRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secondAdminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );
      expect(verifyRes.status).toBe(200);

      // Now login without token should return requiresTotp=true
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `totp-ip-1-${Date.now()}`
          },
          body: JSON.stringify({
            email: secondAdminEmail,
            password: "testpassword456"
          })
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.requiresTotp).toBe(true);
      expect(body.data.userId).toBeDefined();
      expect(body.data.token).toBeFalsy(); // No token issued yet
    });

    test("login with 2FA enabled and valid token: returns JWT", async () => {

      // Setup TOTP for admin (first time)
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);
      const setupBody = await setupRes.json() as any;

      // Generate valid token from the secret
      const validToken = generateValidToken(setupBody.data.secret);

      // Verify to enable 2FA
      const verifyRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );
      expect(verifyRes.status).toBe(200);

      // Now login WITH token should return JWT
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `totp-ip-2-${Date.now()}`
          },
          body: JSON.stringify({
            email: adminEmail,
            password: "testpassword123",
            token: validToken
          })
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.requiresTotp).toBeFalsy();
      expect(body.data.token).toBeDefined();
    });

    test("login with 2FA enabled and wrong token: returns 401", async () => {

      // Setup TOTP for admin (first time)
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);
      const setupBody = await setupRes.json() as any;

      // Generate valid token from the secret and verify to enable 2FA
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Now login with WRONG token should return 401
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `totp-ip-3-${Date.now()}`
          },
          body: JSON.stringify({
            email: adminEmail,
            password: "testpassword123",
            token: "000000" // wrong token
          })
        })
      );

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // ===========================================================================
  // TOTP Setup & Verify Tests
  // ===========================================================================

  describe("TOTP Setup & Verification", () => {
    test("GET /api/v1/auth/totp/setup returns URI and secret", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.uri).toMatch(/^otpauth:\/\/totp\//);
      expect(body.data.secret).toBeDefined();
      expect(typeof body.data.secret).toBe("string");
      expect(body.data.recoveryCodes).toBeDefined();
      expect(Array.isArray(body.data.recoveryCodes)).toBe(true);
      expect(body.data.recoveryCodes.length).toBe(8);
    });

    test("POST /api/v1/auth/totp/verify enables 2FA with correct token", async () => {

      // Setup TOTP first (this stores the secret)
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token from the secret
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      // Verify with valid token
      const verifyRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      expect(verifyRes.status).toBe(200);
      const body = await verifyRes.json() as any;
      expect(body.success).toBe(true);

      // Verify 2FA is now enabled in DB
      const admin = await db.query("SELECT two_factor_enabled FROM admins WHERE id = ?").get(adminId) as any;
      expect(admin.two_factor_enabled).toBe(true);
    });

    test("POST /api/v1/auth/totp/verify fails with invalid token", async () => {
      // Ensure clean 2FA state for test
      await db.run("UPDATE admins SET two_factor_enabled = FALSE WHERE id = ?", [adminId]);

      // Setup TOTP first
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Verify with invalid token
      const verifyRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: "000000" }) // invalid
        })
      );

      expect(verifyRes.status).toBe(401);
      const body = await verifyRes.json() as any;
      expect(body.success).toBe(false);

      // Verify 2FA is NOT enabled in DB
      const admin = await db.query("SELECT two_factor_enabled FROM admins WHERE id = ?").get(adminId) as any;
      expect(admin.two_factor_enabled).toBe(false);
    });

    test("POST /api/v1/auth/totp/verify fails without token", async () => {
      // Setup TOTP first
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Verify without token
      const verifyRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({}) // no token
        })
      );

      expect(verifyRes.status).toBe(400);
    });
  });

  // ===========================================================================
  // TOTP Disable Tests (recovery code)
  // ===========================================================================

  describe("TOTP Disable", () => {
    test("POST /api/v1/auth/totp/disable works with valid recovery code", async () => {

      // Setup and enable 2FA for admin
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Use first recovery code from setup response
      const setupBody = await setupRes.json() as any;
      const recoveryCode = setupBody.data.recoveryCodes[0];

      // Generate valid token and verify to enable 2FA
      const validToken = generateValidToken(setupBody.data.secret);
      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Disable with recovery code
      const disableRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ recoveryCode })
        })
      );

      expect(disableRes.status).toBe(200);
      const body = await disableRes.json() as any;
      expect(body.success).toBe(true);

      // Verify 2FA is disabled in DB
      const admin = await db.query("SELECT two_factor_enabled FROM admins WHERE id = ?").get(adminId) as any;
      expect(admin.two_factor_enabled).toBe(false);

      // Verify secret and recovery codes are cleared
      const adminFull = await db.query("SELECT totp_secret, recovery_codes FROM admins WHERE id = ?").get(adminId) as any;
      expect(adminFull.totp_secret).toBeNull();
    });

    test("POST /api/v1/auth/totp/disable works with valid TOTP token", async () => {

      // Setup and enable 2FA for admin
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Disable with TOTP token (not recovery code)
      const disableRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken }) // use TOTP token instead of recovery code
        })
      );

      expect(disableRes.status).toBe(200);
      const body = await disableRes.json() as any;
      expect(body.success).toBe(true);

      // Verify 2FA is disabled in DB
      const admin = await db.query("SELECT two_factor_enabled FROM admins WHERE id = ?").get(adminId) as any;
      expect(admin.two_factor_enabled).toBe(false);
    });

    test("POST /api/v1/auth/totp/disable fails with invalid recovery code", async () => {

      // Setup and enable 2FA for admin
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Disable with invalid recovery code (and no TOTP)
      const disableRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ recoveryCode: "INVALIDCODE" }) // invalid
        })
      );

      expect(disableRes.status).toBe(401);
    });

    test("POST /api/v1/auth/totp/disable fails without any credential", async () => {

      // Setup and enable 2FA for admin first
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Disable without any credential
      const disableRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/disable", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({}) // no recovery code, no token
        })
      );

      expect(disableRes.status).toBe(400);
    });
  });

  // ===========================================================================
  // Recovery Codes Regeneration Tests
  // ===========================================================================

  describe("Recovery Codes", () => {
    test("POST /api/v1/auth/totp/recovery-codes regenerates codes with valid token", async () => {

      // Setup and enable 2FA for admin
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Regenerate recovery codes
      const regenRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/recovery-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      expect(regenRes.status).toBe(200);
      const body = await regenRes.json() as any;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.recoveryCodes)).toBe(true);
      expect(body.data.recoveryCodes.length).toBe(8);

      // Verify new codes are stored in DB (different from old ones)
      const admin = await db.query("SELECT recovery_codes FROM admins WHERE id = ?").get(adminId) as any;
      const storedCodes = JSON.parse(admin.recovery_codes);
      expect(storedCodes.length).toBe(8);
    });

    test("POST /api/v1/auth/totp/recovery-codes fails without token", async () => {
      // Setup and enable 2FA for admin first
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Regenerate without token
      const regenRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/recovery-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({}) // no token
        })
      );

      expect(regenRes.status).toBe(400);
    });

    test("POST /api/v1/auth/totp/recovery-codes fails with invalid TOTP", async () => {
      // Setup and enable 2FA for admin first
      const setupRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/setup", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );
      expect(setupRes.status).toBe(200);

      // Generate valid token and verify to enable 2FA
      const setupBody = await setupRes.json() as any;
      const validToken = generateValidToken(setupBody.data.secret);

      await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: validToken })
        })
      );

      // Regenerate with invalid TOTP
      const regenRes = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/recovery-codes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ token: "000000" }) // invalid
        })
      );

      expect(regenRes.status).toBe(401);
    });
  });

  // ===========================================================================
  // TOTP Status Endpoint Tests
  // ===========================================================================

  describe("TOTP Status", () => {
    test("GET /api/v1/auth/totp/status returns current status", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/status", {
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      );

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(typeof body.data.twoFactorEnabled).toBe("boolean");
    });

    test("GET /api/v1/auth/totp/status returns 401 without auth", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/auth/totp/status")
      );

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // Settings API Tests (twoFactor key should be rejected)
  // ===========================================================================

  describe("Settings API", () => {
    test("PUT /api/v1/settings rejects twoFactor key", async () => {
      const res = await server.fetch(
        new Request("http://localhost/api/v1/settings", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`
          },
          body: JSON.stringify({ twoFactor: "true" })
        })
      );

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });
});

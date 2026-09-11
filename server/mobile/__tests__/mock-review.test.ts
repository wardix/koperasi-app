import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { app } from "../../index";
import { sql } from "../../db";
import { mockReviewStore } from "../services/mock-review";

describe("Play Store Review Account (In-Memory Mock)", () => {
  const REVIEW_EMAIL = "googleplay.reviewer@example.com";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NUSANET_SSO_REVIEW_EMAIL = REVIEW_EMAIL;
    process.env.NUSANET_SSO_REVIEW_BASE_URL = "https://demo.nusawork.com";
    mockReviewStore.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    mockReviewStore.reset();
  });

  it("completes entire reviewer lifecycle in-memory with zero DB writes", async () => {
    // 1. Snapshot database counts
    const [empCountBefore] = await sql`SELECT COUNT(*)::INT AS total FROM employees WHERE email = ${REVIEW_EMAIL}`;
    const [patCountBefore] = await sql`SELECT COUNT(*)::INT AS total FROM personal_access_tokens WHERE tokenable_id = 999999`;
    const [withCountBefore] = await sql`SELECT COUNT(*)::INT AS total FROM withdrawal_requests WHERE employee_id = 999999`;
    const [loanCountBefore] = await sql`SELECT COUNT(*)::INT AS total FROM loan_applications WHERE employee_id = 999999`;
    const [fcmCountBefore] = await sql`SELECT COUNT(*)::INT AS total FROM employee_fcm_tokens WHERE employee_id = 999999`;

    expect(empCountBefore.total).toBe(0);
    expect(patCountBefore.total).toBe(0);
    expect(withCountBefore.total).toBe(0);
    expect(loanCountBefore.total).toBe(0);
    expect(fcmCountBefore.total).toBe(0);

    // Mock fetch for OTP verify
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/email/")) {
        return new Response(JSON.stringify({ tmp_token: "tmp-demo" }), { status: 200 });
      }
      if (urlStr.includes("/oauth/token")) {
        return new Response(JSON.stringify({ access_token: "demo-at", expires_in: 3600 }), { status: 200 });
      }
      if (urlStr.includes("/user")) {
        return new Response(
          JSON.stringify({ id: 999, email: REVIEW_EMAIL, name: "App Reviewer" }),
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    let token = "";

    try {
      // 2. OTP Verify -> authenticateIdentity gives mock token
      const verifyRes = await app.request("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: REVIEW_EMAIL,
          otp: "123456",
          device_name: "Pixel 7 Pro",
        }),
      });

      expect(verifyRes.status).toBe(201);
      const verifyData = await verifyRes.json();
      expect(verifyData.token).toBeDefined();
      expect(verifyData.employee.email).toBe(REVIEW_EMAIL);
      expect(verifyData.employee.name).toBe("App Reviewer");

      token = verifyData.token;

      // 3. GET /api/profile
      const profileRes = await app.request("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(profileRes.status).toBe(200);
      const profileData = await profileRes.json();
      expect(profileData.data.email).toBe(REVIEW_EMAIL);
      expect(profileData.data.can_request_withdrawal).toBe(true);

      // 4. GET /api/wallet/balance
      const balanceRes = await app.request("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(balanceRes.status).toBe(200);
      const balanceData = await balanceRes.json();
      expect(balanceData.data.can_request).toBe(true);
      expect(balanceData.data.max_withdrawable).toBe(5000000);
      expect(balanceData.data.already_withdrawn).toBe(0);
      expect(balanceData.data.cutoff_day).toBe(25);
      expect(balanceData.data.fee_tiers).toBeArray();
      expect(balanceData.data.fee_tiers.length).toBeGreaterThan(0);
      expect(balanceData.data.period_start).toBeDefined();
      expect(balanceData.data.period_end).toBeDefined();

      // 5. POST /api/withdrawals (Request withdrawal)
      const withdrawRes = await app.request("/api/withdrawals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: 500000 }),
      });
      expect(withdrawRes.status).toBe(201);
      const withdrawData = await withdrawRes.json();
      expect(withdrawData.data.amount).toBe(500000);
      expect(withdrawData.data.status).toBe("pending_transfer");
      const withdrawalId = withdrawData.data.id;

      // Balance should now reflect already_withdrawn
      const balanceRes2 = await app.request("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const balanceData2 = await balanceRes2.json();
      expect(balanceData2.data.already_withdrawn).toBe(500000);
      expect(balanceData2.data.max_withdrawable).toBe(4500000);

      // 6. GET /api/withdrawals (List)
      const listWithRes = await app.request("/api/withdrawals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(listWithRes.status).toBe(200);
      const listWithData = await listWithRes.json();
      expect(listWithData.data.length).toBe(1);
      expect(listWithData.data[0].id).toBe(withdrawalId);

      // 7. GET /api/withdrawals/:id
      const singleWithRes = await app.request(`/api/withdrawals/${withdrawalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(singleWithRes.status).toBe(200);
      const singleWithData = await singleWithRes.json();
      expect(singleWithData.data.id).toBe(withdrawalId);

      // 8. GET /api/loans/membership
      const memberRes = await app.request("/api/loans/membership", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(memberRes.status).toBe(200);
      const memberData = await memberRes.json();
      expect(memberData.data.is_member).toBe(true);

      // 9. POST /api/loans (Apply loan)
      const loanRes = await app.request("/api/loans", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: 2000000,
          tenor_months: 6,
          purpose: "Renovasi Rumah",
        }),
      });
      expect(loanRes.status).toBe(201);
      const loanData = await loanRes.json();
      expect(loanData.data.amount).toBe(2000000);
      expect(loanData.data.tenor_months).toBe(6);
      expect(loanData.data.status).toBe("pending_approval");
      const loanId = loanData.data.id;

      // 10. GET /api/loans (List)
      const listLoansRes = await app.request("/api/loans", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(listLoansRes.status).toBe(200);
      const listLoansData = await listLoansRes.json();
      expect(listLoansData.data.length).toBe(1);
      expect(listLoansData.data[0].id).toBe(loanId);

      // 11. GET /api/loans/:id
      const singleLoanRes = await app.request(`/api/loans/${loanId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(singleLoanRes.status).toBe(200);
      const singleLoanData = await singleLoanRes.json();
      expect(singleLoanData.data.id).toBe(loanId);

      // 12. POST /api/fcm-tokens
      const fcmRes = await app.request("/api/fcm-tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fcm_token: "mock-fcm-token-12345",
          platform: "android",
          device_name: "Pixel 7 Pro",
        }),
      });
      expect(fcmRes.status).toBe(200);
      const fcmData = await fcmRes.json();
      expect(fcmData.data.is_active).toBe(true);

      // 13. POST /api/auth/logout
      const logoutRes = await app.request("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(logoutRes.status).toBe(200);

      // 14. Verification of revoked token
      const profileAfterLogout = await app.request("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(profileAfterLogout.status).toBe(401);

      // 15. Verify ZERO changes to database tables
      const [empCountAfter] = await sql`SELECT COUNT(*)::INT AS total FROM employees WHERE email = ${REVIEW_EMAIL}`;
      const [patCountAfter] = await sql`SELECT COUNT(*)::INT AS total FROM personal_access_tokens WHERE tokenable_id = 999999`;
      const [withCountAfter] = await sql`SELECT COUNT(*)::INT AS total FROM withdrawal_requests WHERE employee_id = 999999`;
      const [loanCountAfter] = await sql`SELECT COUNT(*)::INT AS total FROM loan_applications WHERE employee_id = 999999`;
      const [fcmCountAfter] = await sql`SELECT COUNT(*)::INT AS total FROM employee_fcm_tokens WHERE employee_id = 999999`;

      expect(empCountAfter.total).toBe(0);
      expect(patCountAfter.total).toBe(0);
      expect(withCountAfter.total).toBe(0);
      expect(loanCountAfter.total).toBe(0);
      expect(fcmCountAfter.total).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

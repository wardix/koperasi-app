import { expect, test, describe, beforeAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import { secretKey } from "../middleware";

describe("Stats API Endpoints", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "admin-stats-user-1",
        name: "Admin Koperasi",
        role: "admin",
        email: "admin@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  test("GET /api/v1/stats/pending-actions requires authentication", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/stats/pending-actions")
    );

    expect(res.status).toBe(401);
  });

  test("GET /api/v1/stats/pending-actions returns accurate pending action counts", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/stats/pending-actions", {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    const data = body.data;
    expect(typeof data.totalPending).toBe("number");
    expect(typeof data.pendingLoans).toBe("number");
    expect(typeof data.pendingEwa).toBe("number");
    expect(typeof data.pendingSavingsDeposits).toBe("number");
    expect(typeof data.pendingSavingsWithdrawals).toBe("number");
    expect(typeof data.openFeedbacks).toBe("number");
    expect(typeof data.overdueLoansCount).toBe("number");

    expect(data.totalPending).toBe(
      data.pendingLoans +
      data.pendingEwa +
      data.pendingSavingsDeposits +
      data.pendingSavingsWithdrawals +
      data.openFeedbacks
    );
  });
});

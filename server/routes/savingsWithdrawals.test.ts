import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("Savings Withdrawals API Endpoints", () => {
  const memberId = crypto.randomUUID();
  let memberToken: string;
  let adminToken: string;
  let testWithdrawalId: string;

  beforeAll(async () => {
    // 1. Insert member
    await db.run(
      `INSERT INTO members (id, name, email, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        "Anggota Uji Penarikan",
        "member.withdraw@example.com",
        "Anggota",
        "Aktif",
        "01 Jan 2026",
        500000,
        200000,
        1000000,
        1700000,
      ]
    );

    // 2. Generate tokens
    memberToken = await sign(
      {
        sub: memberId,
        name: "Anggota Uji Penarikan",
        role: "member",
        email: "member.withdraw@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    adminToken = await sign(
      {
        sub: "admin-test-id",
        name: "Admin Tester",
        role: "admin",
        email: "admin@example.com",
        permissions: ["read:members", "update:savings", "approve:loans"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  afterAll(async () => {
    await db.run("DELETE FROM savings_withdrawals WHERE member_id = ?", [memberId]);
    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("GET /api/v1/savings/payment-sources returns available accounts", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/savings/payment-sources", {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    const codes = body.data.map((a: any) => a.code);
    expect(codes).toContain("11102"); // Bank Mandiri
  });

  test("POST /api/v1/portal/savings/withdraw fails when amount > balance", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          amount: 2000000, // exceeds 1,000,000
          destinationBank: "Bank Mandiri",
          destinationAccount: "123456789",
          destinationName: "Anggota Uji",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("melebihi");
  });

  test("POST /api/v1/portal/savings/withdraw succeeds for valid amount", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          amount: 400000,
          destinationBank: "Bank Mandiri",
          destinationAccount: "123456789",
          destinationName: "Anggota Uji Penarikan",
          notes: "Keperluan mendadak",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(400000);
    expect(body.data.status).toBe("Menunggu");
    testWithdrawalId = body.data.id;
  });

  test("GET /api/v1/portal/savings/withdrawals returns member requests", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/withdrawals", {
        headers: { Authorization: `Bearer ${memberToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(testWithdrawalId);
  });

  test("GET /api/v1/savings/withdrawals lists requests for admin", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/savings/withdrawals?status=Menunggu", {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const found = body.data.data.find((w: any) => w.id === testWithdrawalId);
    expect(found).toBeDefined();
    expect(found.memberName).toBe("Anggota Uji Penarikan");
  });

  test("POST /api/v1/savings/withdrawals/:id/approve approves request and deducts savings", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/savings/withdrawals/${testWithdrawalId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          notes: "Approved by finance",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Disetujui");

    // Check member balance
    const member = await db.query("SELECT simpananSukarela, totalSavings FROM members WHERE id = ?").get<any>(memberId);
    expect(Number(member.simpananSukarela)).toBe(600000);
    expect(Number(member.totalSavings)).toBe(1300000);
  });
});

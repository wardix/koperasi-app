import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("Savings Deposits Confirmation API Endpoints", () => {
  const memberId = crypto.randomUUID();
  const todayStr = new Date().toISOString().slice(0, 10);
  let memberToken: string;
  let adminToken: string;
  let wajibDepositId: string;
  let sukarelaDepositId: string;

  beforeAll(async () => {
    // 1. Insert member with Pokok=500000, Wajib=100000, Sukarela=50000
    await db.run(
      `INSERT INTO members (id, name, email, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        "Anggota Uji Setoran",
        "member.deposit@example.com",
        "Anggota",
        "Aktif",
        "01 Jan 2026",
        500000,
        100000,
        50000,
        650000,
      ]
    );

    // 2. Generate tokens
    memberToken = await sign(
      {
        sub: memberId,
        name: "Anggota Uji Setoran",
        role: "member",
        email: "member.deposit@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    adminToken = await sign(
      {
        sub: "admin-deposit-test",
        name: "Admin Deposit Tester",
        role: "admin",
        email: "admin.deposit@example.com",
        permissions: ["read:members", "update:savings"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  afterAll(async () => {
    await db.run("DELETE FROM savings_deposits WHERE member_id = ?", [memberId]);
    await db.run("DELETE FROM transactions WHERE memberId = ?", [memberId]);
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
  });

  test("POST /api/v1/portal/savings/deposit fails if pokok is already paid", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          savingsType: "pokok",
          amount: 100000,
          transferDate: todayStr,
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain("lunas");
  });

  test("POST /api/v1/portal/savings/deposit succeeds without proof (optional proof)", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          savingsType: "wajib",
          amount: 50000,
          transferDate: todayStr,
          senderBank: "Bank Mandiri",
          senderAccount: "1400012345678",
          senderName: "Budi Setoran",
          notes: "Setoran simpanan wajib bulan September",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.savingsType).toBe("wajib");
    expect(body.data.amount).toBe(50000);
    expect(body.data.status).toBe("Menunggu");
    expect(body.data.proofUrl).toBeNull();
    wajibDepositId = body.data.id;
  });

  test("POST /api/v1/portal/savings/deposit succeeds with proof", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          savingsType: "sukarela",
          amount: 200000,
          transferDate: todayStr,
          senderBank: "BCA",
          senderAccount: "0123456789",
          senderName: "Budi Setoran",
          proofUrl: "/uploads/savings/receipt-sukarela.png",
          proofName: "receipt-sukarela.png",
          notes: "Nabung sukarela",
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.savingsType).toBe("sukarela");
    expect(body.data.amount).toBe(200000);
    expect(body.data.proofUrl).toBe("/uploads/savings/receipt-sukarela.png");
    sukarelaDepositId = body.data.id;
  });

  test("GET /api/v1/portal/savings/deposits returns member's deposit history", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/portal/savings/deposits", {
        headers: { Authorization: `Bearer ${memberToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(2);
  });

  test("GET /api/v1/savings/deposits returns admin list with filters", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/savings/deposits?memberId=${memberId}&status=Menunggu`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(2);
    expect(body.data.data.length).toBe(2);
    expect(body.data.data[0].memberName).toBe("Anggota Uji Setoran");
  });

  test("POST /api/v1/savings/deposits/:id/approve approves deposit and updates member savings", async () => {
    // Mandiri account 11102
    const mandiri = await db.query("SELECT id FROM accounts WHERE code = '11102'").get<any>();

    const res = await server.fetch(
      new Request(`http://localhost/api/v1/savings/deposits/${wajibDepositId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          paymentTargetAccountId: mandiri?.id || null,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Diverifikasi");
    expect(body.data.transactionId).toBeDefined();

    // Check member balance (wajib was 100k + 50k = 150k, total was 650k + 50k = 700k)
    const m = await db.query("SELECT simpananWajib, totalSavings FROM members WHERE id = ?").get<any>(memberId);
    expect(Number(m.simpananWajib)).toBe(150000);
    expect(Number(m.totalSavings)).toBe(700000);
  });

  test("POST /api/v1/savings/deposits/:id/reject rejects deposit", async () => {
    const res = await server.fetch(
      new Request(`http://localhost/api/v1/savings/deposits/${sukarelaDepositId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          rejectionReason: "Dana transfer belum masuk ke rekening Bank Mandiri Koperasi",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Ditolak");
    expect(body.data.rejectionReason).toBe("Dana transfer belum masuk ke rekening Bank Mandiri Koperasi");

    // Member balance remains unchanged
    const m = await db.query("SELECT simpananSukarela, totalSavings FROM members WHERE id = ?").get<any>(memberId);
    expect(Number(m.simpananSukarela)).toBe(50000);
    expect(Number(m.totalSavings)).toBe(700000);
  });
});

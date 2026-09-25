import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import { app } from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("Member Portal SHU & Projections API", () => {
  const memberId = crypto.randomUUID();
  let memberToken: string;
  const currentYear = new Date().getFullYear().toString();

  beforeAll(async () => {
    // 1. Insert test member
    await db.run(
      `INSERT INTO members (id, name, email, role, status, joinDate, simpananPokok, simpananWajib, simpananSukarela, totalSavings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memberId,
        "Anggota Uji SHU",
        "member.shu@example.com",
        "Anggota",
        "Aktif",
        `${currentYear}-01-01`,
        1000000,
        500000,
        3500000,
        5000000,
      ]
    );

    // 2. Generate member JWT
    memberToken = await sign(
      {
        sub: memberId,
        name: "Anggota Uji SHU",
        role: "member",
        email: "member.shu@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    // 3. Ensure viewMemberShu is enabled
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('viewMemberShu', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
    );
  });

  afterAll(async () => {
    await db.run("DELETE FROM members WHERE id = ?", [memberId]);
    await db.run("DELETE FROM shu_member_allocations WHERE memberId = ?", [memberId]);
  });

  test("GET /api/v1/portal/shu returns realization and projection for current year", async () => {
    const res = await app.request(`/api/v1/portal/shu?year=${currentYear}`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.year).toBe(currentYear);
    expect(body.data.isCurrentYear).toBe(true);
    expect(body.data.projection).toBeDefined();
    expect(body.data.projection.member).toBeDefined();
    expect(body.data.projection.member.id).toBe(memberId);
    expect(body.data.projection.member.totalSavings).toBe(5000000);
    expect(body.data.projection.member.shu).toBeGreaterThanOrEqual(0);
    expect(body.data.config).toBeDefined();
    expect(body.data.availableYears).toBeArray();
  });

  test("GET /api/v1/portal/shu blocks non-member roles", async () => {
    const adminToken = await sign(
      {
        sub: "admin-id-1",
        name: "Admin User",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    const res = await app.request(`/api/v1/portal/shu`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(401);
  });

  test("GET /api/v1/portal/shu returns 403 when viewMemberShu is disabled", async () => {
    // Disable setting
    await db.run("UPDATE settings SET value = 'false' WHERE key = 'viewMemberShu'");

    const res = await app.request(`/api/v1/portal/shu`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);

    // Re-enable setting
    await db.run("UPDATE settings SET value = 'true' WHERE key = 'viewMemberShu'");
  });

  test("GET /api/v1/portal/shu returns historical allocations when closed", async () => {
    const pastYear = "2023";
    // Insert mock closing and allocation
    await db.run(
      `INSERT INTO shu_closes (year, pendapatan, biayaOperasional, shuNetto, distribusi, closedBy)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (year) DO NOTHING`,
      [pastYear, 10000000, 2000000, 8000000, JSON.stringify({ anggota: 3200000 }), "admin@koperasi.com"]
    );

    await db.run(
      `INSERT INTO shu_member_allocations (year, memberId, savingsShare, loansShare, totalSHU, "averageSavings")
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (year, memberId) DO UPDATE SET totalSHU = EXCLUDED.totalSHU`,
      [pastYear, memberId, 150000, 250000, 400000, 4500000]
    );

    const res = await app.request(`/api/v1/portal/shu`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.historical).toBeArray();
    const pastAlloc = body.data.historical.find((h: any) => h.year === pastYear);
    expect(pastAlloc).toBeDefined();
    expect(pastAlloc.totalSHU).toBe(400000);
    expect(pastAlloc.savingsShare).toBe(150000);
    expect(pastAlloc.loansShare).toBe(250000);

    // Cleanup mock closing
    await db.run("DELETE FROM shu_member_allocations WHERE year = ?", [pastYear]);
    await db.run("DELETE FROM shu_closes WHERE year = ?", [pastYear]);
  });

  test("GET /api/v1/portal/shu projection includes future scheduled loan interest", async () => {
    const loanId = crypto.randomUUID();
    // Insert loan
    await db.run(
      `INSERT INTO loans (id, memberId, name, amount, tenor, status, purpose, createdAt)
       VALUES (?, ?, ?, ?, ?, 'Disetujui', 'Modal Usaha', CURRENT_TIMESTAMP)`,
      [loanId, memberId, "Anggota Uji SHU", 10000000, 12]
    );

    // Insert scheduled pending installment due later this year
    const scheduleId = crypto.randomUUID();
    await db.run(
      `INSERT INTO loan_schedules (id, loanId, installmentNo, dueDate, principalAmount, interestAmount, paidAmount, status)
       VALUES (?, ?, 1, '${currentYear}-11-15', 833333, 150000, 0, 'Pending')`,
      [scheduleId, loanId]
    );

    const res = await app.request(`/api/v1/portal/shu?year=${currentYear}`, {
      headers: {
        Authorization: `Bearer ${memberToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.projection.projectedRevenue).toBeGreaterThanOrEqual(150000);
    expect(body.data.projection.member.loansShare).toBeGreaterThan(0);

    // Cleanup
    await db.run("DELETE FROM loan_schedules WHERE id = ?", [scheduleId]);
    await db.run("DELETE FROM loans WHERE id = ?", [loanId]);
  });
});

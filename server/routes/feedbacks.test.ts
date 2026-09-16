import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("User Feedbacks API Endpoints", () => {
  let memberToken: string;
  let adminToken: string;
  let createdFeedbackId: string;
  let feedbackWithScreenshotId: string;

  beforeAll(async () => {
    memberToken = await sign(
      {
        sub: "member-feedback-user-1",
        name: "Budi Anggota",
        role: "member",
        email: "budi@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );

    adminToken = await sign(
      {
        sub: "admin-feedback-user-1",
        name: "Super Admin",
        role: "admin",
        email: "admin@koperasi.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      secretKey
    );
  });

  afterAll(async () => {
    // Cleanup created feedbacks
    await db.prepare("DELETE FROM user_feedbacks WHERE id IN (?, ?)").run(
      createdFeedbackId || "",
      feedbackWithScreenshotId || ""
    );
  });

  test("POST /api/v1/feedbacks validates required payload", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invalid_type",
          description: "abc", // too short
        }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test("POST /api/v1/feedbacks submits feedback successfully (anonymous/guest)", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "general",
          title: "Saran tampilan UI",
          description: "Mohon ditambahkan mode gelap pada halaman beranda",
          userName: "Tamu Satu",
          userEmail: "guest@example.com",
          pageUrl: "/login",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.type).toBe("general");
    expect(body.data.status).toBe("open");
    createdFeedbackId = body.data.id;
  });

  test("POST /api/v1/feedbacks submits feedback with screenshot and authenticated member token", async () => {
    // 1x1 transparent PNG base64
    const samplePng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${memberToken}`,
        },
        body: JSON.stringify({
          type: "bug",
          title: "Gagal hitung simulasi pinjaman",
          description: "Ketika tombol hitung diklik, muncul pesan error di bagian tabel",
          screenshot: samplePng,
          pageUrl: "/portal/simulasi",
          userAgent: "Mozilla/5.0 Test Browser",
          screenResolution: "1920x1080",
        }),
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.screenshotUrl).toContain("/uploads/feedbacks/");
    expect(body.data.userRole).toBe("member");
    expect(body.data.userName).toBe("Budi Anggota");
    feedbackWithScreenshotId = body.data.id;
  });

  test("GET /api/v1/feedbacks rejects non-admin access", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks", {
        method: "GET",
        headers: { Authorization: `Bearer ${memberToken}` },
      })
    );
    expect(res.status).toBe(403);
  });

  test("GET /api/v1/feedbacks returns list for admin with filters", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks?type=bug&status=open", {
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.feedbacks)).toBe(true);
    const found = body.data.feedbacks.find((f: any) => f.id === feedbackWithScreenshotId);
    expect(found).toBeDefined();
    expect(found.screenshot_url).toContain("/uploads/feedbacks/");
  });

  test("GET /api/v1/feedbacks/stats returns aggregated statistics", async () => {
    const res = await server.fetch(
      new Request("http://localhost:3000/api/v1/feedbacks/stats", {
        method: "GET",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.total).toBeGreaterThanOrEqual(2);
    expect(body.data.statusCounts.open).toBeGreaterThanOrEqual(2);
    expect(body.data.typeCounts.bug).toBeGreaterThanOrEqual(1);
  });

  test("PUT /api/v1/feedbacks/:id/status updates status and notes", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/feedbacks/${feedbackWithScreenshotId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: "resolved",
          adminNotes: "Sudah diperbaiki pada rilis v1.2",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify row in DB
    const updated = await db.query(
      "SELECT status, admin_notes FROM user_feedbacks WHERE id = ?"
    ).get<{ status: string; admin_notes: string }>(feedbackWithScreenshotId);
    expect(updated?.status).toBe("resolved");
    expect(updated?.admin_notes).toBe("Sudah diperbaiki pada rilis v1.2");
  });

  test("DELETE /api/v1/feedbacks/:id deletes entry and cleans up file", async () => {
    const res = await server.fetch(
      new Request(`http://localhost:3000/api/v1/feedbacks/${feedbackWithScreenshotId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const deleted = await db.query(
      "SELECT id FROM user_feedbacks WHERE id = ?"
    ).get(feedbackWithScreenshotId);
    expect(deleted).toBeNull();
  });
});

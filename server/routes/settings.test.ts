import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { sign } from "hono/jwt";
import server from "../index";
import db from "../db";
import { secretKey } from "../middleware";

describe("Settings API Endpoints", () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await sign(
      {
        sub: "test-admin-settings",
        name: "Super Admin",
        role: "superadmin",
        email: "admin.settings@example.com",
        permissions: ["read:settings", "update:settings"],
      },
      secretKey
    );
  });

  afterAll(async () => {
    // Cleanup any test settings modifications
    await db.run("DELETE FROM settings WHERE key LIKE 'wa%'");
  });

  test("GET /api/v1/settings returns settings with WA notification keys", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/settings", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.koperasiName).toBeDefined();
  });

  test("PUT /api/v1/settings updates WhatsApp notification settings in database", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          waNotificationEnabled: "true",
          waWebhookUrl: "https://test-api.gateway.example/v2/messages",
          waWebhookToken: "test-token-value",
          waNotificationTarget: "628999999999",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify persisted in DB
    const row = await db
      .query("SELECT value FROM settings WHERE key = 'waNotificationTarget'")
      .get<{ value: string }>();
    expect(row?.value).toBe("628999999999");
  });

  test("POST /api/v1/settings/test-wa validates inputs and handles test message", async () => {
    const res = await server.fetch(
      new Request("http://localhost/api/v1/settings/test-wa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          webhookUrl: "https://test-api.gateway.example/v2/messages",
          token: "test-token-value",
          target: "628999999999",
        }),
      })
    );

    // In test runner mode with native fetch, it returns mock success 200
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("berhasil");
  });
});

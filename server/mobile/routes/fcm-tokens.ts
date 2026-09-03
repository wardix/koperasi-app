import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../support/validator.js";
import { sql } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const fcmRouter = new Hono();

const storeFcmTokenSchema = z.object({
  fcm_token: z.string().min(1).max(512),
  platform: z.enum(["android", "ios"]),
  device_name: z.string().max(255).optional(),
});

fcmRouter.post("/", authMiddleware, zValidator("json", storeFcmTokenSchema), async (c) => {
  const employee = c.get("employee");
  const { fcm_token, platform, device_name } = c.req.valid("json");

  const [row] = await sql`
    INSERT INTO employee_fcm_tokens (
      employee_id, fcm_token, platform, device_name, is_active, last_registered_at, created_at, updated_at
    ) VALUES (
      ${employee.id}, ${fcm_token}, ${platform}, ${device_name || null}, TRUE, NOW(), NOW(), NOW()
    )
    ON CONFLICT (fcm_token) DO UPDATE SET
      employee_id = EXCLUDED.employee_id,
      platform = EXCLUDED.platform,
      device_name = EXCLUDED.device_name,
      is_active = TRUE,
      deactivated_at = NULL,
      deactivation_reason = NULL,
      last_registered_at = NOW(),
      updated_at = NOW()
    RETURNING id, platform, device_name, is_active, last_registered_at
  `;

  const lastRegistered = new Date(row.last_registered_at);
  const expiresAt = new Date(lastRegistered.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

  return c.json({
    data: {
      id: Number(row.id),
      platform: row.platform,
      device_name: row.device_name,
      is_active: Boolean(row.is_active),
      last_registered_at: lastRegistered.toISOString(),
      expires_at: expiresAt.toISOString(),
    },
  });
});

export default fcmRouter;

import { Hono } from 'hono'
import db from '../db'
import { settingsSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'
import { sendWaTestMessage } from '../services/waNotificationService'

const settings = new Hono()

/** Public branding fields only (safe for login page / unauthenticated UI). */
settings.get('/branding', async (c) => {
  const row = await db
    .query("SELECT value FROM settings WHERE key = 'koperasiName'")
    .get<{ value: string }>()
  return c.json({
    success: true,
    data: {
      koperasiName: row?.value?.trim() || 'Koperasi',
    },
  })
})

settings.get('/', requirePermission('read:settings'), async (c) => {
  const settingsArray = await db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
  const settingsObj: Record<string, string> = {}
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value
  }

  // Fallback to environment variables if not yet saved in database
  if (settingsObj.waNotificationEnabled === undefined && process.env.WA_NOTIFICATION_ENABLED !== undefined) {
    settingsObj.waNotificationEnabled = process.env.WA_NOTIFICATION_ENABLED;
  }
  if (!settingsObj.waWebhookUrl && process.env.WA_WEBHOOK_URL) {
    settingsObj.waWebhookUrl = process.env.WA_WEBHOOK_URL;
  }
  if (!settingsObj.waWebhookToken && process.env.WA_WEBHOOK_TOKEN) {
    settingsObj.waWebhookToken = process.env.WA_WEBHOOK_TOKEN;
  }
  if (!settingsObj.waNotificationTarget && process.env.WA_NOTIFICATION_TARGET) {
    settingsObj.waNotificationTarget = process.env.WA_NOTIFICATION_TARGET;
  }

  return c.json({ success: true, data: settingsObj })
})

settings.post('/test-wa', requirePermission('update:settings'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const result = await sendWaTestMessage({
    db,
    target: body.target,
    webhookUrl: body.webhookUrl,
    token: body.token,
  });
  return c.json(result, result.success ? 200 : 400);
})

settings.put('/', requirePermission('update:settings'), async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    // Upsert so keys missing from seed still persist
    const upsert = await db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
    )

    // Capture before state for audit (current values)
    const currentSettings = await db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
    const beforeMap: Record<string, string> = {}
    for (const s of currentSettings) {
      beforeMap[s.key] = s.value
    }

    await db.transaction(async () => {
      for (const [key, value] of Object.entries(parsed.data)) {
        await upsert.run(key, String(value))
      }
    })()

    // Audit: log settings update
    await audit(db, {
      actor: getActor(c),
      action: 'update_settings',
      entity: 'settings',
      entityId: null,
      before: beforeMap,
      after: Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, String(v)])),
      ip: getClientIp(c),
    })

    clearStatsCache()
    return c.json({ success: true })
  } catch (error) {
    throw error
  }
})

export default settings

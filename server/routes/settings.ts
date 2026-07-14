import { Hono } from 'hono'
import db from '../db'
import { settingsSchema } from '../schemas'
import { requirePermission } from '../middleware'
import { clearStatsCache } from './stats'
import { audit, getActor, getClientIp } from '../lib/audit'

const settings = new Hono()

settings.get('/', requirePermission('read:settings'), async (c) => {
  const settingsArray = await db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
  const settingsObj: Record<string, string> = {}
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value
  }
  return c.json({ success: true, data: settingsObj })
})

settings.put('/', requirePermission('update:settings'), async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const update = await db.prepare("UPDATE settings SET value = ? WHERE key = ?")

    // Capture before state for audit (current values)
    const currentSettings = await db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
    const beforeMap: Record<string, string> = {}
    for (const s of currentSettings) {
      beforeMap[s.key] = s.value
    }

    await db.transaction(async () => {
      for (const [key, value] of Object.entries(parsed.data)) {
        await update.run(String(value), key)
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

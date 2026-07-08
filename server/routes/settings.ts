import { Hono } from 'hono'
import db from '../db'
import { settingsSchema } from '../schemas'
import { requireAdmin } from '../middleware'
import { clearStatsCache } from './stats'

const settings = new Hono()

settings.get('/', async (c) => {
  const settingsArray = await db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
  const settingsObj: Record<string, string> = {}
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value
  }
  return c.json({ success: true, data: settingsObj })
})

settings.put('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const update = await db.prepare("UPDATE settings SET value = ? WHERE key = ?")
    
    await db.transaction(async () => {
      for (const [key, value] of Object.entries(parsed.data)) {
        await update.run(String(value), key)
      }
    })()
    
    clearStatsCache()
    return c.json({ success: true })
  } catch (error) {
    throw error
  }
})

export default settings

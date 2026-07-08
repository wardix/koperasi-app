import { Hono } from 'hono'
import db from '../db'
import { settingsSchema } from '../schemas'
import { requireAdmin } from '../middleware'
import { clearStatsCache } from './stats'

const settings = new Hono()

settings.get('/', (c) => {
  const settingsArray = db.query("SELECT * FROM settings").all() as {key: string, value: string}[]
  const settingsObj: Record<string, string> = {}
  for (const s of settingsArray) {
    settingsObj[s.key] = s.value
  }
  return c.json(settingsObj)
})

settings.put('/', requireAdmin, async (c) => {
  try {
    const body = await c.req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ success: false, errors: parsed.error.format() }, 400)
    }

    const update = db.prepare("UPDATE settings SET value = ? WHERE key = ?")
    
    db.transaction(() => {
      for (const [key, value] of Object.entries(parsed.data)) {
        update.run(String(value), key)
      }
    })()
    
    clearStatsCache()
    return c.json({ success: true })
  } catch (error) {
    throw error
  }
})

export default settings

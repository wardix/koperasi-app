import { Hono } from 'hono'
import { calculateSHU } from '../services/shuService'
import { requirePermission } from '../middleware'

const shu = new Hono()

shu.get('/', requirePermission('read:shu'), async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const data = await calculateSHU(year);
  return c.json({ success: true, data: data })
});

export default shu

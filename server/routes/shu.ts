import { Hono } from 'hono'
import { calculateSHU } from '../services/shuService'

const shu = new Hono()

shu.get('/', async (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const data = await calculateSHU(year);
  return c.json({ success: true, data: data })
});

export default shu

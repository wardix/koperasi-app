import { Hono } from 'hono'
import { calculateSHU } from '../services/shuService'

const shu = new Hono()

shu.get('/', (c) => {
  const year = c.req.query('year') || new Date().getFullYear().toString();
  const result = calculateSHU(year);
  return c.json({ success: true, data: result })
});

export default shu

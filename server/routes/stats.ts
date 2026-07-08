import { Hono } from 'hono'
import db from '../db'

const stats = new Hono()

let cachedStats: any = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearStatsCache() {
  cachedStats = null;
  cacheTime = 0;
}

stats.get('/', async (c) => {
  if (cachedStats && Date.now() - cacheTime < CACHE_TTL) {
    return c.json({ success: true, data: cachedStats })
  }

  // Menjalankan query yang independen secara paralel
  const [
    activeMembersRes,
    totalSavingsRes,
    totalLoansRes,
    totalMacetRes,
    roleRows,
    purposeRows,
    txRows,
    paymentRows,
    recentRows
  ] = await Promise.all([
    Promise.resolve(await db.query("SELECT COUNT(*) as c FROM members WHERE status = 'Aktif'").get() as any),
    Promise.resolve(await db.query("SELECT SUM(totalSavings) as s FROM members").get() as any),
    Promise.resolve(await db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Disetujui'").get() as any),
    Promise.resolve(await db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet'").get() as any),
    Promise.resolve(await db.query("SELECT role, COUNT(*) as count FROM members GROUP BY role").all() as any[]),
    Promise.resolve(await db.query("SELECT purpose, COUNT(*) as count FROM loans GROUP BY purpose").all() as any[]),
    Promise.resolve(await db.query("SELECT TO_CHAR(createdAt::timestamp, 'YYYY-MM') as month, SUM(amount) as total FROM transactions WHERE type LIKE 'setor_%' GROUP BY month").all() as { month: string, total: number }[]),
    Promise.resolve(await db.query("SELECT TO_CHAR(paymentDate::timestamp, 'YYYY-MM') as month, SUM(amount) as total FROM loan_payments GROUP BY month").all() as { month: string, total: number }[]),
    Promise.resolve(await db.query("SELECT id, name, totalSavings, joinDate FROM members ORDER BY id DESC LIMIT 5").all() as any[])
  ]);

  const activeMembers = activeMembersRes?.c || 0;
  const totalSavings = totalSavingsRes?.s || 0;
  const totalLoans = totalLoansRes?.s || 0;
  const totalMacet = totalMacetRes?.s || 0;

  const totalActiveLoans = totalLoans + totalMacet;
  const nplValue = totalActiveLoans > 0 ? ((totalMacet / totalActiveLoans) * 100).toFixed(1) + '%' : '0.0%';

  const roleData = roleRows.map((r, i) => ({
    label: r.role,
    value: r.count,
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const purposeData = purposeRows.map((r, i) => ({
    label: r.purpose,
    value: r.count,
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = d.toISOString().substring(0, 7);
    months.push(monthStr);
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyData = months.map(m => {
    const d = new Date(m + "-01");
    const label = monthNames[d.getMonth()];
    const tx = txRows.find(r => r.month === m);
    const pm = paymentRows.find(r => r.month === m);
    return {
      label,
      simpanan: tx ? tx.total : 0,
      pinjaman: pm ? pm.total : 0
    };
  });
  
  const recentActivities = recentRows.map(m => ({
    id: m.id,
    activity: 'Anggota Baru',
    name: m.name,
    amount: m.totalSavings,
    date: m.joinDate,
  }))

  cachedStats = {
    activeMembers: activeMembers.toString(),
    totalSavings,
    totalLoans,
    npl: nplValue,
    roleData,
    purposeData,
    monthlyData,
    recentActivities
  };
  cacheTime = Date.now();

  return c.json({ success: true, data: cachedStats })
})

export default stats

import { Hono } from 'hono'
import db from '../db'
import type { MemberRow, GroupCount, MonthTotal } from '../db/entities'
import type { DashboardData } from '../../shared/types'
import { requirePermission } from '../middleware'

const stats = new Hono()

let cachedStats: DashboardData | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function clearStatsCache() {
  cachedStats = null;
  cacheTime = 0;
}

stats.get('/', requirePermission('read:stats'), async (c) => {
  if (cachedStats && Date.now() - cacheTime < CACHE_TTL) {
    return c.json({ success: true, data: cachedStats })
  }

  // Menjalankan query yang independen secara paralel
  // Soft-deleted members/loans (deletedAt set) excluded from dashboard / growth trends
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
    db.query("SELECT COUNT(*) as c FROM members WHERE status = 'Aktif' AND deletedAt IS NULL").get<{ c: number }>(),
    db.query("SELECT SUM(totalSavings) as s FROM members WHERE deletedAt IS NULL").get<{ s: number | null }>(),
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Disetujui' AND deletedAt IS NULL").get<{ s: number | null }>(),
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet' AND deletedAt IS NULL").get<{ s: number | null }>(),
    db.query("SELECT role, COUNT(*) as count FROM members WHERE deletedAt IS NULL GROUP BY role").all<GroupCount>(),
    db.query("SELECT purpose, COUNT(*) as count FROM loans WHERE deletedAt IS NULL GROUP BY purpose").all<GroupCount>(),
    db.query(`
      SELECT TO_CHAR(t.createdAt::timestamp, 'YYYY-MM') as month, SUM(t.amount) as total
      FROM transactions t
      INNER JOIN members m ON t.memberId = m.id AND m.deletedAt IS NULL
      WHERE t.type LIKE 'setor_%'
      GROUP BY month
    `).all<MonthTotal>(),
    db.query(`
      SELECT TO_CHAR(p.paymentDate::timestamp, 'YYYY-MM') as month, SUM(p.amount) as total
      FROM loan_payments p
      INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
      GROUP BY month
    `).all<MonthTotal>(),
    db.query("SELECT id, name, totalSavings, joinDate FROM members WHERE deletedAt IS NULL ORDER BY id DESC LIMIT 5").all<Pick<MemberRow, 'id' | 'name' | 'totalSavings' | 'joinDate'>>()
  ]);

  const activeMembers = activeMembersRes?.c || 0;
  const totalSavings = totalSavingsRes?.s || 0;
  const totalLoans = totalLoansRes?.s || 0;
  const totalMacet = totalMacetRes?.s || 0;

  const totalActiveLoans = totalLoans + totalMacet;
  const nplValue = totalActiveLoans > 0 ? ((totalMacet / totalActiveLoans) * 100).toFixed(1) + '%' : '0.0%';

  const roleData = roleRows.map((r, i) => ({
    label: r.role ?? 'Unknown',
    value: Number(r.count),
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const purposeData = purposeRows.map((r, i) => ({
    label: r.purpose ?? 'Unknown',
    value: Number(r.count),
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
      simpanan: Number(tx?.total ?? 0),
      pinjaman: Number(pm?.total ?? 0)
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

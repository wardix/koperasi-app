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

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Local calendar YYYY-MM (avoids UTC month shift from toISOString). */
function yearMonthLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function lastSixYearMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(yearMonthLocal(d));
  }
  return months;
}

stats.get('/', requirePermission('read:stats'), async (c) => {
  if (cachedStats && Date.now() - cacheTime < CACHE_TTL) {
    return c.json({ success: true, data: cachedStats })
  }

  // Soft-deleted members/loans (deletedAt set) excluded from dashboard / growth trends
  const [
    activeMembersRes,
    totalSavingsRes,
    totalLoansRes,
    totalMacetRes,
    roleRows,
    purposeRows,
    savingsNetByMonth,
    loanDisburseByMonth,
    loanPaymentByMonth,
    recentRows
  ] = await Promise.all([
    db.query("SELECT COUNT(*) as c FROM members WHERE status = 'Aktif' AND deletedAt IS NULL").get<{ c: number }>(),
    db.query("SELECT SUM(totalSavings) as s FROM members WHERE deletedAt IS NULL").get<{ s: number | null }>(),
    // Outstanding principal on running loans (approved, not fully paid off)
    db.query(`
      SELECT COALESCE(SUM(GREATEST(0, l.amount - COALESCE(p.paid, 0))), 0) as s
      FROM loans l
      LEFT JOIN (
        SELECT loanId, SUM(amount) as paid FROM loan_payments GROUP BY loanId
      ) p ON p.loanId = l.id
      WHERE l.status IN ('Disetujui', 'Macet')
        AND l.deletedAt IS NULL
    `).get<{ s: number | null }>(),
    db.query("SELECT SUM(amount) as s FROM loans WHERE status = 'Macet' AND deletedAt IS NULL").get<{ s: number | null }>(),
    db.query("SELECT role, COUNT(*) as count FROM members WHERE deletedAt IS NULL GROUP BY role").all<GroupCount>(),
    db.query("SELECT purpose, COUNT(*) as count FROM loans WHERE deletedAt IS NULL GROUP BY purpose").all<GroupCount>(),
    // Net savings flow per month (setor positive, tarik negative)
    db.query(`
      SELECT TO_CHAR(t.createdAt::timestamp, 'YYYY-MM') as month,
             SUM(
               CASE
                 WHEN t.type LIKE 'setor_%' THEN t.amount
                 WHEN t.type LIKE 'tarik_%' THEN -t.amount
                 ELSE 0
               END
             ) as total
      FROM transactions t
      INNER JOIN members m ON t.memberId = m.id AND m.deletedAt IS NULL
      GROUP BY month
    `).all<MonthTotal>(),
    // Loan disbursements (pencairan) by month — active loans only
    db.query(`
      SELECT TO_CHAR(COALESCE(l.approvedAt, l.createdAt::timestamp), 'YYYY-MM') as month,
             SUM(l.amount) as total
      FROM loans l
      WHERE l.deletedAt IS NULL
        AND l.status IN ('Disetujui', 'Lunas', 'Macet')
      GROUP BY month
    `).all<MonthTotal>(),
    // Loan payments by month — active loans only
    db.query(`
      SELECT TO_CHAR(p.paymentDate::timestamp, 'YYYY-MM') as month,
             SUM(p.amount) as total
      FROM loan_payments p
      INNER JOIN loans l ON p.loanId = l.id AND l.deletedAt IS NULL
      GROUP BY month
    `).all<MonthTotal>(),
    db.query("SELECT id, name, totalSavings, joinDate FROM members WHERE deletedAt IS NULL ORDER BY id DESC LIMIT 5").all<Pick<MemberRow, 'id' | 'name' | 'totalSavings' | 'joinDate'>>()
  ]);

  const activeMembers = toNumber(activeMembersRes?.c);
  const totalSavings = toNumber(totalSavingsRes?.s);
  const totalLoans = toNumber(totalLoansRes?.s);
  const totalMacet = toNumber(totalMacetRes?.s);

  const totalActiveLoansPrincipal = totalLoans + totalMacet;
  // NPL on outstanding-style base: macet principal / (running outstanding + macet)
  // Keep simple: macet amount / (disetujui outstanding + macet amount) when possible
  const nplValue =
    totalActiveLoansPrincipal > 0
      ? ((totalMacet / (totalLoans + totalMacet)) * 100).toFixed(1) + '%'
      : '0.0%';

  const roleData = roleRows.map((r, i) => ({
    label: r.role ?? 'Unknown',
    value: toNumber(r.count),
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const purposeData = purposeRows.map((r, i) => ({
    label: r.purpose ?? 'Unknown',
    value: toNumber(r.count),
    color: ['var(--color-data-categorical-blue, #0171E3)', 'var(--color-data-categorical-orange, #EB6E00)', 'var(--color-data-categorical-green, #0B991F)', 'var(--color-data-categorical-purple, #6B1EFD)'][i % 4]
  }))

  const months = lastSixYearMonths();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const savingsNetMap = new Map(savingsNetByMonth.map((r) => [r.month, toNumber(r.total)]));
  const disburseMap = new Map(loanDisburseByMonth.map((r) => [r.month, toNumber(r.total)]));
  const paymentMap = new Map(loanPaymentByMonth.map((r) => [r.month, toNumber(r.total)]));

  // Cumulative growth series (matches "Tren Pertumbuhan" expectation):
  // - simpanan: running saldo simpanan (net of setor/tarik up to that month)
  // - pinjaman: running sisa pokok (pencairan − angsuran up to that month, floored at 0)
  let cumSavings = 0;
  let cumDisbursed = 0;
  let cumPaid = 0;

  // Include history before the 6-month window so cumulative starts correctly
  const firstMonth = months[0];
  for (const [month, total] of savingsNetMap) {
    if (month < firstMonth) cumSavings += total;
  }
  for (const [month, total] of disburseMap) {
    if (month < firstMonth) cumDisbursed += total;
  }
  for (const [month, total] of paymentMap) {
    if (month < firstMonth) cumPaid += total;
  }

  const monthlyData = months.map((m) => {
    const [y, mo] = m.split('-').map(Number);
    const label = monthNames[mo - 1] ?? m;

    cumSavings += savingsNetMap.get(m) ?? 0;
    cumDisbursed += disburseMap.get(m) ?? 0;
    cumPaid += paymentMap.get(m) ?? 0;

    return {
      label,
      simpanan: cumSavings,
      pinjaman: Math.max(0, cumDisbursed - cumPaid),
    };
  });

  // Align last point with live KPIs when possible (handles edge cases / rounding)
  if (monthlyData.length > 0) {
    const last = monthlyData[monthlyData.length - 1];
    // Prefer live totals for current month end (source of truth on cards)
    last.simpanan = totalSavings;
    last.pinjaman = totalLoans;
  }
  
  const recentActivities = recentRows.map(m => ({
    id: m.id,
    activity: 'Anggota Baru',
    name: m.name,
    amount: toNumber(m.totalSavings),
    date: m.joinDate,
  }))

  cachedStats = {
    activeMembers: String(activeMembers),
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

import db from '../db'
import type { ShuCloseRow, ShuAllocationRow, InterestPaymentRow, MemberRow, SettingRow } from '../db/entities'
import { calculateLoanInterest } from './loanService'

/**
 * Get SHU configuration from settings table.
 * Returns default values if settings not found.
 */
export interface MemberSavingsStats {
  memberId: string;
  name: string;
  status: string;
  totalSavings: number;
  averageSavings: number;
}

/**
 * Calculates the time-weighted Average Daily Balance (ADB) of savings
 * for all members throughout the specified fiscal year.
 */
export async function calculateMemberAverageSavings(
  year: string,
  includeInactive: boolean = true
): Promise<Record<string, MemberSavingsStats>> {
  const yearNum = parseInt(year, 10);
  const isLeap = (yearNum % 4 === 0 && yearNum % 100 !== 0) || (yearNum % 400 === 0);

  const startOfYearISO = `${year}-01-01T00:00:00.000Z`;
  const endOfYearISO = `${year}-12-31T23:59:59.999Z`;
  const startOfYearMs = Date.parse(startOfYearISO);
  const endOfYearMs = Date.parse(endOfYearISO);
  const totalYearMs = endOfYearMs - startOfYearMs + 1;

  // 1. Fetch members
  let memberQuery = "SELECT id, name, status, joinDate, totalSavings FROM members";
  if (!includeInactive) {
    memberQuery += " WHERE status = 'Aktif'";
  }
  const members = await db.query(memberQuery).all<Pick<MemberRow, "id" | "name" | "status" | "joinDate" | "totalSavings">>();

  if (members.length === 0) return {};

  // 2. Fetch the latest balance before startOfYear for each member
  const priorTxs = await db.query(`
    SELECT DISTINCT ON (memberId)
      memberId, balanceAfter
    FROM transactions
    WHERE createdAt < ?
    ORDER BY memberId, seq DESC
  `).all<{ memberId: string; balanceAfter: number | string }>(startOfYearISO);

  const priorBalanceMap: Record<string, number> = {};
  for (const pt of priorTxs) {
    priorBalanceMap[pt.memberId] = Number(pt.balanceAfter || 0);
  }

  // 3. Fetch all transactions within the year
  const yearTxs = await db.query(`
    SELECT memberId, balanceBefore, balanceAfter, createdAt, seq
    FROM transactions
    WHERE createdAt >= ? AND createdAt <= ?
    ORDER BY memberId, seq ASC
  `).all<{
    memberId: string;
    balanceBefore: number | string;
    balanceAfter: number | string;
    createdAt: string;
    seq: number | string;
  }>(startOfYearISO, endOfYearISO);

  const txsByMember: Record<string, Array<{ balanceBefore: number; balanceAfter: number; createdAtMs: number }>> = {};
  for (const tx of yearTxs) {
    const mId = tx.memberId;
    if (!txsByMember[mId]) txsByMember[mId] = [];
    txsByMember[mId].push({
      balanceBefore: Number(tx.balanceBefore || 0),
      balanceAfter: Number(tx.balanceAfter || 0),
      createdAtMs: Date.parse(tx.createdAt),
    });
  }

  const result: Record<string, MemberSavingsStats> = {};

  for (const m of members) {
    const mId = m.id;
    const currentSavings = Number(m.totalSavings || 0);
    const memberTxs = txsByMember[mId] || [];

    // If member has no transactions recorded in this year or prior
    if (memberTxs.length === 0) {
      const joinMs = m.joinDate ? Date.parse(m.joinDate) : startOfYearMs;
      if (isNaN(joinMs) || joinMs <= startOfYearMs) {
        result[mId] = {
          memberId: mId,
          name: m.name,
          status: m.status || 'Aktif',
          totalSavings: currentSavings,
          averageSavings: currentSavings,
        };
        continue;
      }
      if (joinMs > endOfYearMs) {
        result[mId] = {
          memberId: mId,
          name: m.name,
          status: m.status || 'Aktif',
          totalSavings: currentSavings,
          averageSavings: 0,
        };
        continue;
      }
      const duration = Math.max(0, endOfYearMs - joinMs + 1);
      const avgSavings = Math.max(0, Math.round((currentSavings * duration) / totalYearMs));
      result[mId] = {
        memberId: mId,
        name: m.name,
        status: m.status || 'Aktif',
        totalSavings: currentSavings,
        averageSavings: avgSavings,
      };
      continue;
    }

    // Determine starting balance on Jan 1
    let initialBalance = 0;
    if (priorBalanceMap[mId] !== undefined) {
      initialBalance = priorBalanceMap[mId];
    } else {
      const joinMs = m.joinDate ? Date.parse(m.joinDate) : startOfYearMs;
      if (joinMs <= startOfYearMs) {
        initialBalance = memberTxs[0].balanceBefore;
      } else {
        initialBalance = 0;
      }
    }

    // Time-weighted integration
    let runningBalance = initialBalance;
    let lastTime = startOfYearMs;
    let weightedSum = 0;

    for (const tx of memberTxs) {
      const txTime = Math.max(startOfYearMs, Math.min(endOfYearMs, tx.createdAtMs));
      const duration = Math.max(0, txTime - lastTime);
      weightedSum += runningBalance * duration;
      runningBalance = tx.balanceAfter;
      lastTime = txTime;
    }

    const remainingDuration = Math.max(0, endOfYearMs - lastTime + 1);
    weightedSum += runningBalance * remainingDuration;

    const avgSavings = Math.max(0, Math.round(weightedSum / totalYearMs));

    result[mId] = {
      memberId: mId,
      name: m.name,
      status: m.status || 'Aktif',
      totalSavings: currentSavings,
      averageSavings: avgSavings,
    };
  }

  return result;
}

/**
 * Get SHU configuration from settings table.
 * Returns default values if settings not found.
 */
export async function getShuConfig() {
  const settings = await db.query("SELECT key, value FROM settings").all<SettingRow>();
  const configMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

  return {
    cadanganPct: parseFloat(configMap['shu_cadangan_pct'] || '25'),
    anggotaPct: parseFloat(configMap['shu_anggota_pct'] || '40'),
    pengurusPct: parseFloat(configMap['shu_pengurus_pct'] || '20'),
    sosialPct: parseFloat(configMap['shu_sosial_pct'] || '10'),
    pembangunanPct: parseFloat(configMap['shu_pembangunan_pct'] || '5'),
    jasaSimpananPct: parseFloat(configMap['shu_jasa_simpanan_pct'] || '50'),
    jasaPinjamanPct: parseFloat(configMap['shu_jasa_pinjaman_pct'] || '50'),
    includeInactiveMembers: configMap['shu_include_inactive_members'] !== 'false',
  };
}

export interface CalculateSHUOptions {
  mode?: 'realization' | 'projection';
}

/**
 * Calculate SHU (Sisa Hasil Usaha) for a given year.
 * If the year is already closed (locked), returns historical data from shu_closes table.
 * Otherwise, calculates dynamically:
 *   - mode 'realization' (default): based on actual interest paid YTD
 *   - mode 'projection': adds projected interest from active loan schedules due until year-end
 */
export async function calculateSHU(year: string, options?: CalculateSHUOptions) {
  const mode = options?.mode || 'realization';
  const config = await getShuConfig();

  // 1. Check if this year is already closed (locked)
  const isClosed = await db.query("SELECT * FROM shu_closes WHERE year = ?").get<ShuCloseRow>(year);
  if (isClosed) {
    // Return historical data from locked period
    const allocations = await db.query(`
      SELECT sma.*, m.name, m.totalsavings, m.status
      FROM shu_member_allocations sma
      JOIN members m ON sma.memberId = m.id
      WHERE sma.year = ?
      ORDER BY sma.totalSHU DESC
    `).all<ShuAllocationRow & { status?: string; averageSavings?: number | string }>(year);

    const closedPendapatan = Number(isClosed.pendapatan);
    return {
      year,
      mode: 'realization' as const,
      isClosed: true,
      closedAt: isClosed.closedAt,
      closedBy: isClosed.closedBy,
      pendapatan: closedPendapatan,
      realizedPendapatan: closedPendapatan,
      projectedPendapatan: 0,
      biayaOperasional: Number(isClosed.biayaOperasional),
      shuNetto: Number(isClosed.shuNetto),
      distribusi: typeof isClosed.distribusi === 'string' ? JSON.parse(isClosed.distribusi as string) : isClosed.distribusi,
      alokasiAnggota: allocations.map(a => ({
        id: a.memberId,
        name: a.name,
        status: a.status || 'Aktif',
        totalSavings: Number(a.totalSavings || 0),
        averageSavings: Number(a.averageSavings ?? a.totalSavings ?? 0),
        savingsShare: Number(a.savingsShare || 0),
        loansShare: Number(a.loansShare || 0),
        shu: Number(a.totalSHU || 0)
      })),
      config
    };
  }

  // 2. If not closed, calculate dynamically
  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get<{ value: string }>();
  const bungaRate = parseFloat(bungaSetting?.value || '1.5');

  // Get all payments for the given year
  const payments = await db.query(`
    SELECT lp.amount as paymentAmount, l.amount as principalAmount, l.tenor, l.memberId
    FROM loan_payments lp
    JOIN loans l ON lp.loanId = l.id
    WHERE TO_CHAR(lp.paymentDate::timestamp, 'YYYY') = ?
  `).all<InterestPaymentRow>(year);

  let totalRealizedInterest = 0;
  const memberInterestPaid: Record<string, number> = {};

  for (const p of payments) {
    const pAmt = Number(p.paymentAmount || 0);
    const princAmt = Number(p.principalAmount || 0);
    const mId = p.memberId || '';

    // Calculate interest portion for this payment
    const { interestAmount, totalAmount } = calculateLoanInterest(princAmt, p.tenor ?? 0, bungaRate);
    const interestPaid = totalAmount > 0 ? Math.round(pAmt * (interestAmount / totalAmount)) : 0;

    totalRealizedInterest += interestPaid;
    memberInterestPaid[mId] = (memberInterestPaid[mId] || 0) + interestPaid;
  }

  let totalProjectedInterest = 0;

  if (mode === 'projection') {
    // Pending installments for active loans due from today onwards within the target year
    const projectedRows = await db.query(`
      SELECT 
        l.memberId,
        SUM(ls.interestAmount) as "projectedInterest"
      FROM loan_schedules ls
      JOIN loans l ON ls.loanId = l.id
      WHERE l.status IN ('Disetujui', 'Macet') AND l.deletedAt IS NULL
        AND ls.status = 'Pending'
        AND ls.dueDate >= CURRENT_DATE
        AND TO_CHAR(ls.dueDate, 'YYYY') = ?
      GROUP BY l.memberId
    `).all<{ memberId: string; projectedInterest: number | string }>(year);

    for (const pr of projectedRows) {
      const pInterest = Math.round(Number(pr.projectedInterest || 0));
      const mId = pr.memberId || '';
      totalProjectedInterest += pInterest;
      memberInterestPaid[mId] = (memberInterestPaid[mId] || 0) + pInterest;
    }
  }

  const totalPendapatanBunga = totalRealizedInterest + totalProjectedInterest;

  // Calculate operating cost:
  // 1. Manual override from settings if set (e.g. from closing or manual input)
  // 2. Otherwise query actual recorded expenses from general ledger (accounts of type 'EXPENSE')
  // 3. Fallback to default 20% of interest income if no expense journals exist
  const biayaOpsSetting = await db.query("SELECT value FROM settings WHERE key = ?").get<{ value: string }>(`biaya_operasional_${year}`);

  let biayaOperasional: number;
  if (biayaOpsSetting) {
    biayaOperasional = Math.round(parseFloat(biayaOpsSetting.value));
  } else {
    const expenseRow = await db.query(`
      SELECT 
        COALESCE(SUM(jl.debit - jl.credit), 0) as total,
        COUNT(jl.id) as count
      FROM journal_lines jl
      JOIN accounts a ON jl.account_id = a.id
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      WHERE a.type = 'EXPENSE' AND TO_CHAR(je.transaction_date, 'YYYY') = ?
    `).get<{ total: number | string; count: number | string }>(year);

    const hasJournalExpenses = Number(expenseRow?.count || 0) > 0;
    if (hasJournalExpenses) {
      biayaOperasional = Math.max(0, Math.round(Number(expenseRow?.total || 0)));
    } else {
      biayaOperasional = Math.round(totalPendapatanBunga * 0.2);
    }
  }

  const shuNetto = Math.max(0, totalPendapatanBunga - biayaOperasional);

  // Calculate distribution based on configurable percentages
  const distribusi = {
    anggota: Math.round(shuNetto * (config.anggotaPct / 100)),
    cadangan: Math.round(shuNetto * (config.cadanganPct / 100)),
    pengurus: Math.round(shuNetto * (config.pengurusPct / 100)),
    sosial: Math.round(shuNetto * (config.sosialPct / 100)),
    pembangunan: Math.round(shuNetto * (config.pembangunanPct / 100)),
  };

  // Split anggota allocation between Jasa Simpanan and Jasa Pinjaman
  const totalJasaSimpananPool = Math.round(distribusi.anggota * (config.jasaSimpananPct / 100));
  const totalJasaPinjamanPool = Math.round(distribusi.anggota * (config.jasaPinjamanPct / 100));

  // Get all members with their time-weighted average savings (ADB)
  const memberSavingsMap = await calculateMemberAverageSavings(year, config.includeInactiveMembers);
  const eligibleMembers = Object.values(memberSavingsMap);

  const totalSimpananSeluruhAnggota = eligibleMembers.reduce((sum, m) => sum + m.averageSavings, 0);
  const totalBungaDibayarSeluruhAnggota = Object.values(memberInterestPaid).reduce((sum, val) => sum + val, 0);

  const alokasiAnggota = eligibleMembers.map(m => {
    const savings = m.totalSavings;
    const avgSavings = m.averageSavings;
    const interestPaid = memberInterestPaid[m.memberId] || 0;

    // Calculate proportion for each component: Jasa Simpanan uses averageSavings
    const porsiSimpanan = totalSimpananSeluruhAnggota > 0 ? avgSavings / totalSimpananSeluruhAnggota : 0;
    const porsiPinjaman = totalBungaDibayarSeluruhAnggota > 0 ? interestPaid / totalBungaDibayarSeluruhAnggota : 0;

    // Calculate share amounts
    const savingsShare = Math.round(totalJasaSimpananPool * porsiSimpanan);
    const loansShare = Math.round(totalJasaPinjamanPool * porsiPinjaman);

    return {
      id: m.memberId,
      name: m.name,
      status: m.status,
      totalSavings: savings,
      averageSavings: avgSavings,
      savingsShare,
      loansShare,
      shu: savingsShare + loansShare
    };
  }).sort((a, b) => b.shu - a.shu);

  return {
    year,
    mode,
    isClosed: false,
    pendapatan: totalPendapatanBunga,
    realizedPendapatan: totalRealizedInterest,
    projectedPendapatan: totalProjectedInterest,
    biayaOperasional,
    shuNetto,
    distribusi,
    alokasiAnggota,
    config
  };
}

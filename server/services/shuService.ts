import db from '../db'
import type { ShuCloseRow, ShuAllocationRow, InterestPaymentRow, MemberRow, SettingRow } from '../db/entities'
import { calculateLoanInterest } from './loanService'

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
  };
}

/**
 * Calculate SHU (Sisa Hasil Usaha) for a given year.
 * If the year is already closed (locked), returns historical data from shu_closes table.
 * Otherwise, calculates dynamically using combined formula:
 *   - Jasa Simpanan: based on member's savings proportion
 *   - Jasa Pinjaman: based on interest paid by member proportion
 */
export async function calculateSHU(year: string) {
  // 1. Check if this year is already closed (locked)
  const isClosed = await db.query("SELECT * FROM shu_closes WHERE year = ?").get<ShuCloseRow>(year);
  if (isClosed) {
    // Return historical data from locked period
    const allocations = await db.query(`
      SELECT sma.*, m.name, m.totalsavings
      FROM shu_member_allocations sma
      JOIN members m ON sma.memberId = m.id
      WHERE sma.year = ?
      ORDER BY sma.totalSHU DESC
    `).all<ShuAllocationRow>(year);

    return {
      year,
      isClosed: true,
      closedAt: isClosed.closedAt,
      closedBy: isClosed.closedBy,
      pendapatan: Number(isClosed.pendapatan),
      biayaOperasional: Number(isClosed.biayaOperasional),
      shuNetto: Number(isClosed.shuNetto),
      distribusi: typeof isClosed.distribusi === 'string' ? JSON.parse(isClosed.distribusi as string) : isClosed.distribusi,
      alokasiAnggota: allocations.map(a => ({
        id: a.memberId,
        name: a.name,
        totalSavings: a.totalSavings,
        savingsShare: a.savingsShare,
        loansShare: a.loansShare,
        shu: a.totalSHU
      }))
    };
  }

  // 2. If not closed, calculate dynamically
  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get<{ value: string }>();
  const bungaRate = parseFloat(bungaSetting?.value || '1.5');
  const config = await getShuConfig();

  // Get all payments for the given year
  const payments = await db.query(`
    SELECT lp.amount as paymentAmount, l.amount as principalAmount, l.tenor, l.memberId
    FROM loan_payments lp
    JOIN loans l ON lp.loanId = l.id
    WHERE TO_CHAR(lp.paymentDate::timestamp, 'YYYY') = ?
  `).all<InterestPaymentRow>(year);

  let totalPendapatanBunga = 0;
  const memberInterestPaid: Record<string, number> = {};

  for (const p of payments) {
    const pAmt = Number(p.paymentAmount || 0);
    const princAmt = Number(p.principalAmount || 0);
    const mId = p.memberId || '';

    // Calculate interest portion for this payment
    const { interestAmount, totalAmount } = calculateLoanInterest(princAmt, p.tenor ?? 0, bungaRate);
    const interestPaid = totalAmount > 0 ? Math.round(pAmt * (interestAmount / totalAmount)) : 0;

    totalPendapatanBunga += interestPaid;
    memberInterestPaid[mId] = (memberInterestPaid[mId] || 0) + interestPaid;
  }

  // Get annual operating cost input if exists, otherwise use default 20%
  const biayaOpsSetting = await db.query("SELECT value FROM settings WHERE key = ?").get<{ value: string }>(`biaya_operasional_${year}`);
  const biayaOperasional = biayaOpsSetting ? Math.round(parseFloat(biayaOpsSetting.value)) : Math.round(totalPendapatanBunga * 0.2);
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

  // Get all members and calculate their shares
  const members = await db.query("SELECT id, name, totalSavings FROM members").all<Pick<MemberRow, "id" | "name" | "totalSavings">>();
  const totalSimpananSeluruhAnggota = members.reduce((sum, m) => sum + Number(m.totalSavings || 0), 0);
  const totalBungaDibayarSeluruhAnggota = Object.values(memberInterestPaid).reduce((sum, val) => sum + val, 0);

  const alokasiAnggota = members.map(m => {
    const savings = Number(m.totalSavings || 0);
    const interestPaid = memberInterestPaid[m.id] || 0;

    // Calculate proportion for each component
    const porsiSimpanan = totalSimpananSeluruhAnggota > 0 ? savings / totalSimpananSeluruhAnggota : 0;
    const porsiPinjaman = totalBungaDibayarSeluruhAnggota > 0 ? interestPaid / totalBungaDibayarSeluruhAnggota : 0;

    // Calculate share amounts
    const savingsShare = Math.round(totalJasaSimpananPool * porsiSimpanan);
    const loansShare = Math.round(totalJasaPinjamanPool * porsiPinjaman);

    return {
      id: m.id,
      name: m.name,
      totalSavings: savings,
      savingsShare,
      loansShare,
      shu: savingsShare + loansShare
    };
  }).sort((a, b) => b.shu - a.shu);

  return {
    year,
    isClosed: false,
    pendapatan: totalPendapatanBunga,
    biayaOperasional,
    shuNetto,
    distribusi,
    alokasiAnggota
  };
}

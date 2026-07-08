import db from '../db'
import { calculateLoanInterest } from './loanService'

export async function calculateSHU(year: string) {
  const bungaSetting = await db.query("SELECT value FROM settings WHERE key = 'bungaPinjaman'").get() as { value: string } | undefined;
  const bungaRate = parseFloat(bungaSetting?.value || '1.5');

  const payments = await db.query(`
    SELECT lp.amount as paymentAmount, l.amount as principalAmount, l.tenor
    FROM loan_payments lp
    JOIN loans l ON lp.loanId = l.id
    WHERE TO_CHAR(lp.paymentDate::timestamp, 'YYYY') = ?
  `).all(year) as any[];

  let pendapatan = 0;
  for (const p of payments) {
    const pAmt = p.paymentAmount ?? p.paymentamount ?? 0;
    const princAmt = p.principalAmount ?? p.principalamount ?? 0;
    const { interestAmount, totalAmount } = calculateLoanInterest(princAmt, p.tenor, bungaRate);
    const interestPaid = totalAmount > 0 ? Math.round(pAmt * (interestAmount / totalAmount)) : 0;
    pendapatan += interestPaid;
  }
  
  const biayaOperasional = Math.round(pendapatan * 0.2); // Asumsi biaya ops 20%
  const shuNetto = Math.max(0, pendapatan - biayaOperasional);
  
  const distribusi = {
    anggota: Math.round(shuNetto * 0.40),
    cadangan: Math.round(shuNetto * 0.25),
    pengurus: Math.round(shuNetto * 0.20),
    sosial: Math.round(shuNetto * 0.10),
    pembangunan: Math.round(shuNetto * 0.05),
  };
  
  const members = await db.query("SELECT id, name, totalSavings FROM members").all() as any[];
  const totalSimpananSeluruhAnggota = members.reduce((sum, m) => sum + m.totalSavings, 0);
  
  const alokasiAnggota = members.map(m => {
    const porsi = totalSimpananSeluruhAnggota > 0 ? m.totalSavings / totalSimpananSeluruhAnggota : 0;
    return {
      id: m.id,
      name: m.name,
      totalSavings: m.totalSavings,
      shu: Math.round(distribusi.anggota * porsi)
    };
  }).sort((a, b) => b.shu - a.shu);
  
  return {
    year,
    pendapatan,
    biayaOperasional,
    shuNetto,
    distribusi,
    alokasiAnggota
  };
}

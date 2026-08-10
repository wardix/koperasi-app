import db from '../server/db';
import * as fs from 'node:fs';

// Helper to write CSV
function writeCsv(filename: string, headers: string[], data: any[]) {
  const lines = [headers.join(',')];
  for (const row of data) {
    const values = headers.map(h => {
      const val = row[h] ?? '';
      // Escape quotes and wrap in quotes if there's a comma
      const strVal = String(val).replace(/"/g, '""');
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal}"`;
      }
      return strVal;
    });
    lines.push(values.join(','));
  }
  fs.writeFileSync(filename, lines.join('\n'));
  console.log(`Berhasil mengekspor ${data.length} baris ke ${filename}`);
}

async function runExport() {
  try {
    console.log('Mengekspor data Koperasi ke CSV...');
    
    // 1. Members
    const members = await db.query(`
      SELECT nik, name as nama, phone as no_hp, simpananpokok as simpanan_pokok 
      FROM members 
      WHERE deletedat IS NULL
      ORDER BY name ASC
    `).all();
    writeCsv('export_members.csv', ['nik', 'nama', 'no_hp', 'simpanan_pokok'], members as any);

    // 2. Savings (Simpanan)
    const savings = await db.query(`
      SELECT m.nik, m.name as nama, t.type as jenis_simpanan, t.amount as nominal, t.createdat::date as tanggal
      FROM transactions t
      JOIN members m ON t.memberid = m.id
      WHERE t.type IN ('Simpanan Wajib', 'Simpanan Sukarela')
      ORDER BY t.createdat ASC
    `).all();
    writeCsv('export_savings.csv', ['nik', 'nama', 'jenis_simpanan', 'nominal', 'tanggal'], savings as any);

    // 3. Loans
    const loans = await db.query(`
      SELECT m.nik, m.name as nama, l.id as loan_id, l.name as nama_pinjaman, l.amount as jumlah, l.tenor, l.interestrate as bunga, l.purpose as tujuan, l.createdat::date as tanggal_pinjaman
      FROM loans l
      JOIN members m ON l.memberid = m.id
      WHERE l.deletedat IS NULL
      ORDER BY l.createdat ASC
    `).all();
    writeCsv('export_loans.csv', ['nik', 'nama', 'loan_id', 'nama_pinjaman', 'jumlah', 'tenor', 'bunga', 'tujuan', 'tanggal_pinjaman'], loans as any);

    // 4. Installments (Angsuran)
    const installments = await db.query(`
      SELECT m.nik, m.name as nama, p.loanid as loan_id, p.amount as jumlah, p.method as metode, p.paymentdate::date as tanggal
      FROM loan_payments p
      JOIN loans l ON p.loanid = l.id
      JOIN members m ON l.memberid = m.id
      ORDER BY p.paymentdate ASC
    `).all();
    writeCsv('export_installments.csv', ['nik', 'nama', 'loan_id', 'jumlah', 'metode', 'tanggal'], installments as any);

    console.log('Proses ekspor selesai!');
  } catch (error) {
    console.error('Gagal mengekspor data:', error);
  } finally {
    process.exit(0);
  }
}

runExport();

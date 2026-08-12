import db from "../server/db";

async function main() {
  console.log("Menghapus Jurnal Lama...");
  await db.run("DELETE FROM journal_lines");
  await db.run("DELETE FROM journal_entries");
  console.log("Menghapus Chart of Accounts lama...");
  await db.run("DELETE FROM accounts");

  const initialAccounts = [
    // Aset
    { code: '11101', name: 'Kas Kecil', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '11102', name: 'Bank Mandiri', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '11201', name: 'Piutang Pinjaman Anggota', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '11202', name: 'Cadangan Kerugian Piutang', type: 'ASSET', normal_balance: 'CREDIT' }, // Contra-asset
    { code: '11301', name: 'Piutang Potong Gaji (Payroll)', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '11401', name: 'Perlengkapan Kantor', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '12101', name: 'Peralatan Kantor', type: 'ASSET', normal_balance: 'DEBIT' },
    { code: '12102', name: 'Akumulasi Penyusutan Peralatan', type: 'ASSET', normal_balance: 'CREDIT' }, // Contra-asset
    // Kewajiban
    { code: '21101', name: 'Simpanan Sukarela Anggota', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '21102', name: 'Simpanan Berjangka Koperasi', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '21201', name: 'Beban Yang Masih Harus Dibayar', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '21301', name: 'Utang Pajak (PPh 21/23/Final)', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '22101', name: 'Dana Bagian RAT', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '22102', name: 'Dana Pengurus & Pengawas', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '22103', name: 'Dana Karyawan', type: 'LIABILITY', normal_balance: 'CREDIT' },
    { code: '22104', name: 'Dana Sosial & Pendidikan', type: 'LIABILITY', normal_balance: 'CREDIT' },
    // Ekuitas
    { code: '31101', name: 'Simpanan Pokok', type: 'EQUITY', normal_balance: 'CREDIT' },
    { code: '31102', name: 'Simpanan Wajib', type: 'EQUITY', normal_balance: 'CREDIT' },
    { code: '32101', name: 'Cadangan Koperasi', type: 'EQUITY', normal_balance: 'CREDIT' },
    { code: '33101', name: 'SHU Ditahan', type: 'EQUITY', normal_balance: 'CREDIT' },
    { code: '33102', name: 'SHU Tahun Berjalan', type: 'EQUITY', normal_balance: 'CREDIT' },
    // Pendapatan
    { code: '41101', name: 'Pendapatan Jasa Pinjaman', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '41102', name: 'Pendapatan Provisi / Administrasi', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '42101', name: 'Pendapatan Bunga Bank', type: 'REVENUE', normal_balance: 'CREDIT' },
    { code: '42102', name: 'Pendapatan Denda', type: 'REVENUE', normal_balance: 'CREDIT' },
    // Beban
    { code: '51101', name: 'Beban Jasa Simpanan Sukarela', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '51102', name: 'Beban Jasa Simpanan Berjangka', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '61101', name: 'Beban Gaji & Tunjangan Karyawan', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '61102', name: 'Beban Kerugian Piutang Macet', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '61201', name: 'Beban Operasional Kantor', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '61202', name: 'Beban Penyusutan Aset', type: 'EXPENSE', normal_balance: 'DEBIT' },
    { code: '61301', name: 'Beban Pelaksanaan RAT', type: 'EXPENSE', normal_balance: 'DEBIT' },
  ];

  console.log("Mengisi Chart of Accounts baru...");
  for (const acc of initialAccounts) {
    await db.run(
      `INSERT INTO accounts (id, code, name, type, normal_balance) VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
      [acc.code, acc.name, acc.type, acc.normal_balance]
    );
  }

  console.log("Chart of Accounts berhasil diperbarui!");
  process.exit(0);
}

main().catch(console.error);

import * as XLSX from 'xlsx';

export interface ParsedSavingsImportRow {
  nik: string;
  memberName?: string;
  savingsType: 'pokok' | 'wajib' | 'sukarela';
  amount: number;
  transactionDate?: string;
  isValid: boolean;
  error?: string;
}

/**
 * Downloads a clean CSV template for batch savings import based on NIK.
 * If membersToInclude is provided, pre-fills their NIK and Name for quick editing.
 */
export function downloadSavingsCsvTemplate(
  membersToInclude?: Array<{ name: string; nik?: string | null; simpananPokok?: number }>
) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const filename = `Template_Import_Simpanan_${today}.csv`;
    
    const data: any[] = [];
    
    if (membersToInclude && membersToInclude.length > 0) {
      membersToInclude.forEach((m) => {
        data.push({
          nik: m.nik || '',
          nama: m.name || '',
          jenis_simpanan: 'wajib',
          nominal: 50000,
          tanggal: today
        });
      });
    } else {
      data.push({ nik: '3171012345670001', nama: 'Budi Santoso', jenis_simpanan: 'wajib', nominal: 50000, tanggal: today });
      data.push({ nik: '3171012345670002', nama: 'Siti Rahma', jenis_simpanan: 'wajib', nominal: 50000, tanggal: today });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    XLSX.writeFile(workbook, filename, { bookType: 'csv' });
  } catch (err) {
    console.error('Failed to download CSV template:', err);
  }
}

/**
 * Parses a CSV file containing columns: nik, nama, jenis_simpanan, nominal, tanggal.
 * Supports both comma (,) and semicolon (;) delimiters.
 */
export async function parseSavingsCsvFile(file: File): Promise<ParsedSavingsImportRow[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('File CSV kosong atau tidak memiliki data.');
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = parseCsvLine(headerLine, delimiter).map((h) =>
    h.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  );

  const nikIdx = headers.findIndex((h) => h === 'nik' || h === 'id' || h === 'nikanggota');
  const namaIdx = headers.findIndex((h) => h === 'nama' || h === 'namaanggota' || h === 'name');
  const jenisIdx = headers.findIndex((h) =>
    h === 'jenissimpanan' || h === 'tipesimpanan' || h === 'jenis' || h === 'tipe' || h === 'type'
  );
  const nominalIdx = headers.findIndex((h) =>
    h === 'nominal' || h === 'setoran' || h === 'amount' || h === 'jumlah' || h === 'total'
  );
  const tanggalIdx = headers.findIndex((h) => h === 'tanggal' || h === 'date' || h === 'tgl');

  if (nikIdx === -1) {
    throw new Error('Header "nik" tidak ditemukan pada file CSV.');
  }
  if (nominalIdx === -1) {
    throw new Error('Header "nominal" (setoran) tidak ditemukan pada file CSV.');
  }

  const rows: ParsedSavingsImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => !c.trim())) continue;

    const rawNik = (cols[nikIdx] || '').trim();
    const cleanNik = rawNik.replace(/\D/g, '');
    const memberName = namaIdx !== -1 ? (cols[namaIdx] || '').trim() : undefined;
    const rawType = (jenisIdx !== -1 ? cols[jenisIdx] : '').toLowerCase().trim();
    const rawNominal = (cols[nominalIdx] || '').trim();
    const rawTanggal = tanggalIdx !== -1 ? (cols[tanggalIdx] || '').trim() : undefined;

    let savingsType: 'pokok' | 'wajib' | 'sukarela' = 'pokok';
    if (rawType.includes('wajib')) savingsType = 'wajib';
    else if (rawType.includes('sukarela')) savingsType = 'sukarela';

    const cleanAmountStr = rawNominal.replace(/[^\d]/g, '');
    const amount = parseInt(cleanAmountStr, 10);

    let isValid = true;
    let error: string | undefined;

    if (!cleanNik || cleanNik.length !== 16) {
      isValid = false;
      error = 'NIK harus 16 digit angka';
    } else if (isNaN(amount) || amount <= 0) {
      isValid = false;
      error = 'Nominal setoran tidak valid (> 0)';
    }

    rows.push({
      nik: cleanNik || rawNik,
      memberName,
      savingsType,
      amount: isNaN(amount) ? 0 : amount,
      transactionDate: rawTanggal || undefined,
      isValid,
      error,
    });
  }

  return rows;
}

/** Helper to parse a single CSV line respecting quotes */
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

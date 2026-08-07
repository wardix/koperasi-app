import * as XLSX from 'xlsx';

function formatDateToYmd(val: any): string | undefined {
  if (!val) return undefined;
  
  // Handle Excel serial number date
  if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('-') && !String(val).includes('/'))) {
    const num = Number(val);
    if (num > 30000 && num < 60000) {
      const parsed = XLSX.SSF.parse_date_code(num);
      if (parsed) {
        const yyyy = parsed.y;
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  const str = String(val).trim();
  if (!str) return undefined;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(str);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = ymdMatch[2].padStart(2, '0');
    const dd = ymdMatch[3].padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(str);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return str;
}

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
 * Parses an Excel or CSV file containing columns: nik, nama, jenis_simpanan, nominal, tanggal.
 * Handles different column namings gracefully.
 */
export async function parseSavingsImportFile(file: File): Promise<ParsedSavingsImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Get raw JSON
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('File kosong atau tidak memiliki data.');
  }

  // Get headers (keys of first row) lowercased and cleaned
  const firstRowKeys = Object.keys(rows[0] || {});
  
  const findKey = (possibleNames: string[]) => {
    return firstRowKeys.find(k => {
      const cleanK = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      return possibleNames.includes(cleanK);
    });
  };

  const nikKey = findKey(['nik', 'id', 'nikanggota']);
  const namaKey = findKey(['nama', 'namaanggota', 'name']);
  const jenisKey = findKey(['jenissimpanan', 'tipesimpanan', 'jenis', 'tipe', 'type']);
  const nominalKey = findKey(['nominal', 'setoran', 'amount', 'jumlah', 'total']);
  const tanggalKey = findKey(['tanggal', 'date', 'tgl']);

  if (!nikKey) {
    throw new Error('Header "nik" tidak ditemukan pada file.');
  }
  if (!nominalKey) {
    throw new Error('Header "nominal" (setoran) tidak ditemukan pada file.');
  }

  const parsedRows: ParsedSavingsImportRow[] = [];

  for (const row of rows) {
    // If all values are empty string, skip
    if (Object.values(row).every(v => v === '')) continue;

    const rawNik = String(row[nikKey] || '').trim();
    const cleanNik = rawNik.replace(/\D/g, '');
    const memberName = namaKey ? String(row[namaKey] || '').trim() : undefined;
    const rawType = jenisKey ? String(row[jenisKey] || '').toLowerCase().trim() : '';
    const rawNominal = String(row[nominalKey] || '').trim();
    const rawTanggal = tanggalKey ? formatDateToYmd(row[tanggalKey]) : undefined;

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

    parsedRows.push({
      nik: cleanNik || rawNik,
      memberName,
      savingsType,
      amount: isNaN(amount) ? 0 : amount,
      transactionDate: rawTanggal || undefined,
      isValid,
      error,
    });
  }

  return parsedRows;
}

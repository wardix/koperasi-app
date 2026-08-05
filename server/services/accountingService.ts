
import db from '../db'
import type { AccountRow } from '../db/entities'

export type JournalLineInput = {
  account_code: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export type AutoJournalInput = {
  transaction_date: string;
  description: string;
  reference_type: string;
  reference_id: string;
  lines: JournalLineInput[];
}

let _accountsCache: Record<string, string> = {};
let _cacheTime = 0;

async function getAccountIdByCode(code: string): Promise<string> {
  const now = Date.now();
  if (now - _cacheTime > 60000 || !_accountsCache[code]) {
    const rows = await db.query(`SELECT id, code FROM accounts`).all<AccountRow>();
    _accountsCache = rows.reduce((acc, row) => {
      acc[row.code] = row.id;
      return acc;
    }, {} as Record<string, string>);
    _cacheTime = now;
  }
  
  const id = _accountsCache[code];
  if (!id) throw new Error(`Kode Akun ${code} tidak ditemukan di database.`);
  return id;
}

export async function recordAutoJournal(input: AutoJournalInput): Promise<string> {
  const entryId = crypto.randomUUID();
  
  // 1. Validasi Balance
  const totalDebit = input.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Auto-Journal Error: Debit (${totalDebit}) & Kredit (${totalCredit}) tidak seimbang.`);
  }

  if (totalDebit <= 0) return entryId; // Skip if no value

  await db.transaction(async () => {
    // 2. Insert Header
    await db.run(`
      INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [entryId, input.transaction_date, input.description, input.reference_type, input.reference_id]);

    // 3. Insert Lines
    for (const line of input.lines) {
      if ((line.debit || 0) === 0 && (line.credit || 0) === 0) continue;
      
      const accountId = await getAccountIdByCode(line.account_code);
      await db.run(`
        INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
      `, [entryId, accountId, line.debit || 0, line.credit || 0, line.description || null]);
    }
  })();

  return entryId;
}

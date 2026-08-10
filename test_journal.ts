import db from './server/db';
import crypto from 'crypto';

async function test() {
  const data = {
    "transaction_date": "2026-07-05",
    "description": "Pencairan Pinjaman Modal Usaha Tahap I (PT. Media Antar Nusa)",
    "lines": [
      {
        "account_id": "3fd3deae-73a0-4790-a87b-45cb7b7af1f8",
        "debit": 50000000,
        "credit": 0
      },
      {
        "account_id": "1a96a665-386f-4b3b-8216-f3aed4f4754c",
        "debit": 0,
        "credit": 50000000
      }
    ]
  };

  try {
    const entryId = crypto.randomUUID();
    const actor = '1dd1dd29-66db-4644-b6e9-cbdde43dce96';

    await db.transaction(async () => {
      console.log('inserting header');
      await db.run(`
        INSERT INTO journal_entries (id, transaction_date, description, reference_type, reference_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entryId, data.transaction_date, data.description, null, null, actor]);

      console.log('inserting lines');
      for (const line of data.lines) {
        await db.run(`
          INSERT INTO journal_lines (id, journal_entry_id, account_id, debit, credit, description)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        `, [entryId, line.account_id, line.debit, line.credit, null]);
      }
    })();
    console.log('success');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}

test();

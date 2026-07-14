import { SQL } from "bun";
import { AsyncLocalStorage } from "node:async_hooks";
import { applyAllMigrations } from "./migrations";
import { runSeed } from "./seed";

const sql = new SQL(process.env.DATABASE_URL || "postgres://koperasi:koperasi_pass@localhost:5432/koperasi_test");

/** Active transactional client (same connection that issued BEGIN). */
const txStorage = new AsyncLocalStorage<SQL>();

function getSql(): SQL {
  return txStorage.getStore() ?? sql;
}

class Statement {
  queryStr: string;
  constructor(queryStr: string) { this.queryStr = queryStr; }
  getPgQuery() { let i = 1; return this.queryStr.replace(/\?/g, () => "$" + (i++)); }
  // Postgres returns unquoted identifiers lowercased; map back to app camelCase.
  mapRow(row: Record<string, unknown> | null) {
    if (!row) return row;
    const keyMap: Record<string, string> = {
      balancebefore: 'balanceBefore',
      balanceafter: 'balanceAfter',
      paymentdate: 'paymentDate',
      paymentamount: 'paymentAmount',
      principalamount: 'principalAmount',
      totalsavings: 'totalSavings',
      simpananpokok: 'simpananPokok',
      simpananwajib: 'simpananWajib',
      simpanansukarela: 'simpananSukarela',
      joindate: 'joinDate',
      createdby: 'createdBy',
      createdat: 'createdAt',
      memberid: 'memberId',
      loanid: 'loanId',
      paidamount: 'paidAmount',
      interestrate: 'interestRate',
      monthlypayment: 'monthlyPayment',
      interestamount: 'interestAmount',
      totalamount: 'totalAmount',
      approvedat: 'approvedAt'
    };
    const mapped: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      mapped[keyMap[k] || k] = v;
    }
    return mapped;
  }
  async get(...args: unknown[]) {
    const rows = await getSql().unsafe(this.getPgQuery(), args);
    return rows.length > 0 ? this.mapRow(rows[0]) : null;
  }
  async all(...args: unknown[]) {
    const res = await getSql().unsafe(this.getPgQuery(), args);
    return Array.isArray(res) ? res.map((r: Record<string, unknown>) => this.mapRow(r)) : [];
  }
  async run(...args: unknown[]) {
    await getSql().unsafe(this.getPgQuery(), args);
  }
}

const db = {
  query: (q: string) => new Statement(q),
  prepare: (q: string) => new Statement(q),
  run: async (q: string, args: unknown[] = []) => { await new Statement(q).run(...args); },
  /**
   * Run work inside a real Postgres transaction on one reserved connection.
   * Keeps the historical call shape: `await db.transaction(async () => { ... })()`.
   * Nested calls reuse the outer transaction (no nested BEGIN).
   */
  transaction: <TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult> | TResult
  ) => {
    return async (...args: TArgs): Promise<TResult> => {
      const existing = txStorage.getStore();
      if (existing) {
        return await cb(...args);
      }
      return await sql.begin(async (tx) => {
        return await txStorage.run(tx as unknown as SQL, async () => {
          return await cb(...args);
        });
      });
    };
  },
  close: () => sql.end()
};

// ---------------------------------------------------------------------------
// Schema via formal migrations (server/migrations) — fail-fast, no swallow.
// Seed is separate (server/seed.ts).
// ---------------------------------------------------------------------------

await applyAllMigrations(db);
await runSeed(db);

export default db;

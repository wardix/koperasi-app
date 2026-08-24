import type { Migration } from "./types";

/**
 * Migration 0025: Add Earned Wage Access (EWA) tables and COA accounts.
 * - company_employees: Master employee records for parent company (members & non-members).
 * - ewa_requests: EWA advance transactions and payroll deduction tracking.
 */
export function createAddEwaServiceMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0025_add_ewa_service",
    async up() {
      // 1. Company Employees Table
      await db.run(`
        CREATE TABLE IF NOT EXISTS company_employees (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nip VARCHAR(50) UNIQUE NOT NULL,
          nik VARCHAR(20),
          name VARCHAR(150) NOT NULL,
          email VARCHAR(150) UNIQUE NOT NULL,
          phone VARCHAR(30),
          department VARCHAR(100),
          position VARCHAR(100),
          base_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
          member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
          is_member BOOLEAN DEFAULT false NOT NULL,
          bank_name VARCHAR(50),
          bank_account_number VARCHAR(50),
          bank_account_name VARCHAR(150),
          status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // 2. EWA Requests Table
      await db.run(`
        CREATE TABLE IF NOT EXISTS ewa_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          employee_id UUID NOT NULL REFERENCES company_employees(id) ON DELETE CASCADE,
          period_month VARCHAR(7) NOT NULL, -- e.g. '2026-08'
          salary_basis DECIMAL(15,2) NOT NULL,
          max_limit DECIMAL(15,2) NOT NULL, -- 50% of salary_basis minus prior advances in same period
          amount_requested DECIMAL(15,2) NOT NULL,
          fee_percentage DECIMAL(5,2) NOT NULL, -- e.g. 2.00 for member, 3.50 for non-member
          fee_amount DECIMAL(15,2) NOT NULL,
          disbursed_amount DECIMAL(15,2) NOT NULL,
          total_payroll_deduction DECIMAL(15,2) NOT NULL, -- amount_requested + fee_amount
          destination_bank VARCHAR(50),
          destination_account VARCHAR(50),
          destination_name VARCHAR(150),
          status VARCHAR(30) DEFAULT 'PENDING' NOT NULL, -- PENDING, APPROVED, DISBURSED, REJECTED, PAID_SETTLED, CANCELLED
          rejection_reason TEXT,
          disbursed_at TIMESTAMP WITH TIME ZONE,
          disbursed_by TEXT REFERENCES admins(id),
          settled_at TIMESTAMP WITH TIME ZONE,
          journal_entry_id UUID REFERENCES journal_entries(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Indexes for performance
      await db.run(`CREATE INDEX IF NOT EXISTS idx_company_employees_email ON company_employees(email)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_company_employees_nip ON company_employees(nip)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_company_employees_member_id ON company_employees(member_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_ewa_requests_employee ON ewa_requests(employee_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_ewa_requests_period ON ewa_requests(period_month)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_ewa_requests_status ON ewa_requests(status)`);

      // 3. Add EWA specific revenue account in Chart of Accounts if not exists
      const existingAcc = (await db.query(
        `SELECT id FROM accounts WHERE code = '41103' LIMIT 1`
      ).get()) as { id?: string } | undefined;

      if (!existingAcc?.id) {
        await db.run(
          `INSERT INTO accounts (code, name, type, normal_balance) VALUES ($1, $2, $3, $4)`,
          ['41103', 'Pendapatan Administrasi EWA', 'REVENUE', 'CREDIT']
        );
      }
    },
  };
}

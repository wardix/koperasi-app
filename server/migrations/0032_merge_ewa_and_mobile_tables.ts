import type { Migration } from "./types";

/**
 * Migration 0032: Merge EWA (company_employees, ewa_requests) into mobile tables (employees, withdrawal_requests).
 * - Expands employees table with HR master fields (nip, department, position, base_salary, member_id, is_member, contract_end_date, phone).
 * - Syncs existing 276 company_employees records into employees.
 * - Expands withdrawal_requests with accounting fields (journal_entry_id, disbursed_by, period_month, etc.).
 * - Migrates existing historical ewa_requests into withdrawal_requests.
 */
export function createMergeEwaAndMobileTablesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0032_merge_ewa_and_mobile_tables",
    async up() {
      // 1. Add HR columns to employees
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS nip VARCHAR(50)`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS department VARCHAR(100)`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS position VARCHAR(100)`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS base_salary DECIMAL(15,2) NOT NULL DEFAULT 0`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS member_id TEXT REFERENCES members(id) ON DELETE SET NULL`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_member BOOLEAN NOT NULL DEFAULT false`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_end_date DATE`);
      await db.run(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(30)`);

      await db.run(`CREATE INDEX IF NOT EXISTS idx_employees_nip ON employees(nip)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employees_member_id ON employees(member_id)`);

      // 2. Sync HR fields from company_employees to employees
      await db.run(`
        UPDATE employees e
        SET 
          nip = ce.nip,
          department = ce.department,
          position = ce.position,
          base_salary = ce.base_salary,
          member_id = ce.member_id,
          is_member = ce.is_member,
          contract_end_date = ce.contract_end_date,
          phone = COALESCE(e.phone, ce.phone)
        FROM company_employees ce
        WHERE LOWER(e.email) = LOWER(ce.email)
      `);

      // Insert any remaining company_employees that were not yet in employees
      await db.run(`
        INSERT INTO employees (
          employer_id, name, email, nik, nip, department, position, base_salary,
          member_id, is_member, contract_end_date, phone,
          withdrawal_limit, join_date, bank_name, bank_account_number, bank_account_holder, status
        )
        SELECT 
          1, ce.name, ce.email, ce.nik, ce.nip, ce.department, ce.position, ce.base_salary,
          ce.member_id, ce.is_member, ce.contract_end_date, ce.phone,
          COALESCE(ce.base_salary::bigint, 0),
          DATE(COALESCE(ce.created_at, NOW())),
          ce.bank_name, ce.bank_account_number, ce.bank_account_name, LOWER(ce.status)
        FROM company_employees ce
        WHERE NOT EXISTS (
          SELECT 1 FROM employees e WHERE LOWER(e.email) = LOWER(ce.email)
        )
        AND ce.email IS NOT NULL AND ce.email != ''
      `);

      // 3. Add accounting and calculation tracking columns to withdrawal_requests
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS disbursed_by TEXT REFERENCES admins(id) ON DELETE SET NULL`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS period_month VARCHAR(7)`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS salary_basis DECIMAL(15,2)`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS max_limit DECIMAL(15,2)`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS fee_percentage DECIMAL(5,2)`);
      await db.run(`ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS total_payroll_deduction DECIMAL(15,2)`);

      // 4. Migrate ewa_requests into withdrawal_requests
      await db.run(`
        INSERT INTO withdrawal_requests (
          employee_id, employer_id, amount, fee, status,
          pay_period_start, pay_period_end, period_month,
          salary_basis, max_limit, fee_percentage, total_payroll_deduction,
          destination_bank_name, destination_account_number, destination_account_holder,
          requested_at, transferred_at, disbursed_by, rejected_at, rejection_reason, settled_at, journal_entry_id, created_at, updated_at
        )
        SELECT 
          e.id,
          1,
          er.amount_requested::bigint,
          er.fee_amount::bigint,
          CASE 
            WHEN er.status = 'DISBURSED' THEN 'transferred'
            WHEN er.status = 'REJECTED' THEN 'rejected'
            WHEN er.status = 'PAID_SETTLED' THEN 'settled'
            ELSE 'pending_transfer'
          END,
          COALESCE(TO_DATE(er.period_month || '-01', 'YYYY-MM-DD'), CURRENT_DATE),
          COALESCE((TO_DATE(er.period_month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date, CURRENT_DATE),
          er.period_month,
          er.salary_basis,
          er.max_limit,
          er.fee_percentage,
          er.total_payroll_deduction,
          er.destination_bank,
          er.destination_account,
          er.destination_name,
          er.created_at,
          er.disbursed_at,
          er.disbursed_by,
          CASE WHEN er.status = 'REJECTED' THEN er.updated_at ELSE NULL END,
          er.rejection_reason,
          er.settled_at,
          er.journal_entry_id,
          er.created_at,
          er.updated_at
        FROM ewa_requests er
        JOIN company_employees ce ON er.employee_id = ce.id
        JOIN employees e ON LOWER(e.email) = LOWER(ce.email)
        WHERE NOT EXISTS (
          SELECT 1 FROM withdrawal_requests wr 
          WHERE wr.employee_id = e.id AND wr.created_at = er.created_at
        )
      `);
    },
  };
}

import type { Migration } from "./types";

/**
 * Migration 0031: Add Kopnutera Flutter Mobile Backend Tables.
 * - employers: Companies/employers participating in EWA.
 * - employees: Employee roster for Flutter mobile authentication & EWA limits.
 * - personal_access_tokens: Sanctum-compatible Bearer tokens (SHA-256 hash).
 * - withdrawal_requests: EWA cash advance requests from mobile app.
 * - employee_fcm_tokens: Push notification tokens (Android/iOS).
 * - loan_applications: Loan requests submitted from mobile app.
 */
export function createAddKopnuteraMobileTablesMigration(db: {
  run: (q: string, args?: unknown[]) => Promise<void>;
  query: (q: string) => { get: (...args: unknown[]) => Promise<unknown> };
}): Migration {
  return {
    name: "0031_add_kopnutera_mobile_tables",
    async up() {
      // 1. Employers
      await db.run(`
        CREATE TABLE IF NOT EXISTS employers (
          id BIGSERIAL PRIMARY KEY,
          company_name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL UNIQUE,
          email_domain VARCHAR(255),
          cutoff_day SMALLINT NOT NULL DEFAULT 25,
          fee_tiers JSONB,
          max_withdrawal_amount BIGINT NOT NULL DEFAULT 5000000,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          contact_email VARCHAR(255),
          contact_phone VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employers_email_domain ON employers(email_domain)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employers_status ON employers(status)`);

      // Seed default Nusanet employer if not exists
      await db.run(`
        INSERT INTO employers (company_name, slug, email_domain, cutoff_day, fee_tiers, max_withdrawal_amount, status)
        VALUES (
          'Nusanet',
          'nusanet',
          'nusanet.net.id',
          25,
          '[{"min": 0, "max": 500000, "fee": 15000}, {"min": 500001, "max": 1000000, "fee": 25000}, {"min": 1000001, "max": 2000000, "fee": 35000}, {"min": 2000001, "max": 5000000, "fee": 50000}]'::jsonb,
          5000000,
          'active'
        )
        ON CONFLICT (slug) DO NOTHING
      `);

      // 2. Employees
      await db.run(`
        CREATE TABLE IF NOT EXISTS employees (
          id BIGSERIAL PRIMARY KEY,
          employer_id BIGINT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          sso_subject_id VARCHAR(255) UNIQUE,
          nik VARCHAR(20),
          withdrawal_limit BIGINT NOT NULL DEFAULT 0,
          join_date DATE NOT NULL DEFAULT CURRENT_DATE,
          bank_name VARCHAR(100),
          bank_account_number VARCHAR(100),
          bank_account_holder VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          kyc_status VARCHAR(50) NOT NULL DEFAULT 'unverified',
          kyc_verified_at TIMESTAMP WITH TIME ZONE,
          last_signed_in_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_employees_employer_email UNIQUE (employer_id, email)
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employees_employer_status ON employees(employer_id, status)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email)`);

      // 3. Personal Access Tokens (Sanctum Compatible)
      await db.run(`
        CREATE TABLE IF NOT EXISTS personal_access_tokens (
          id BIGSERIAL PRIMARY KEY,
          tokenable_type VARCHAR(255) NOT NULL DEFAULT 'App\\\\Models\\\\Employee',
          tokenable_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          token VARCHAR(64) NOT NULL UNIQUE,
          abilities JSONB DEFAULT '["*"]'::jsonb,
          last_used_at TIMESTAMP WITH TIME ZONE,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_tokenable ON personal_access_tokens(tokenable_type, tokenable_id)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_personal_access_tokens_token ON personal_access_tokens(token)`);

      // 4. Withdrawal Requests (EWA)
      await db.run(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id BIGSERIAL PRIMARY KEY,
          employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          employer_id BIGINT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
          amount BIGINT NOT NULL,
          fee BIGINT NOT NULL,
          fee_tier_snapshot JSONB,
          status VARCHAR(50) NOT NULL DEFAULT 'pending_transfer',
          flagged BOOLEAN NOT NULL DEFAULT FALSE,
          flag_reason TEXT,
          pay_period_start DATE NOT NULL,
          pay_period_end DATE NOT NULL,
          destination_bank_name VARCHAR(100),
          destination_account_number VARCHAR(100),
          destination_account_holder VARCHAR(255),
          requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          transferred_at TIMESTAMP WITH TIME ZONE,
          transferred_by_name VARCHAR(255),
          rejected_at TIMESTAMP WITH TIME ZONE,
          rejected_by_name VARCHAR(255),
          rejection_reason TEXT,
          settled_at TIMESTAMP WITH TIME ZONE,
          idempotency_key VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_withdrawal_requests_emp_idempotency UNIQUE (employee_id, idempotency_key)
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_emp_period_status ON withdrawal_requests(employee_id, pay_period_start, status)`);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_employer_status_req ON withdrawal_requests(employer_id, status, requested_at)`);

      // 5. Employee FCM Tokens
      await db.run(`
        CREATE TABLE IF NOT EXISTS employee_fcm_tokens (
          id BIGSERIAL PRIMARY KEY,
          employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          fcm_token VARCHAR(512) NOT NULL UNIQUE,
          platform VARCHAR(16) NOT NULL,
          device_name VARCHAR(255),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          deactivated_at TIMESTAMP WITH TIME ZONE,
          deactivation_reason VARCHAR(32),
          last_registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_employee_fcm_tokens_emp_active ON employee_fcm_tokens(employee_id, is_active)`);

      // 6. Loan Applications
      await db.run(`
        CREATE TABLE IF NOT EXISTS loan_applications (
          id BIGSERIAL PRIMARY KEY,
          employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          reference VARCHAR(40) NOT NULL UNIQUE,
          external_id VARCHAR(255),
          amount BIGINT NOT NULL,
          tenor_months SMALLINT NOT NULL,
          purpose VARCHAR(255),
          status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
          annual_interest_rate DECIMAL(9, 5) NOT NULL,
          monthly_installment BIGINT NOT NULL,
          total_interest BIGINT NOT NULL,
          total_repayment BIGINT NOT NULL,
          terms_snapshot JSONB,
          schedule_snapshot JSONB,
          first_due_date DATE,
          submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          decided_at TIMESTAMP WITH TIME ZONE,
          decided_by_name VARCHAR(255),
          rejection_reason TEXT,
          disbursed_at TIMESTAMP WITH TIME ZONE,
          cancelled_at TIMESTAMP WITH TIME ZONE,
          idempotency_key VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_loan_applications_emp_idempotency UNIQUE (employee_id, idempotency_key)
        )
      `);
      await db.run(`CREATE INDEX IF NOT EXISTS idx_loan_applications_emp_status_submitted ON loan_applications(employee_id, status, submitted_at)`);
    },
  };
}

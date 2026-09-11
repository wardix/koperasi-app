export interface MockWithdrawal {
  id: number;
  employee_id: number;
  employer_id: number;
  amount: number;
  fee: number;
  net_amount: number;
  daily_rate: number;
  days_worked: number;
  pay_period_start: string;
  pay_period_end: string;
  cutoff_day: number;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  status: string;
  requested_at: string;
  disbursed_at: string | null;
  rejection_reason: string | null;
}

export interface MockLoan {
  id: number;
  employee_id: number;
  reference: string;
  external_id: string;
  amount: number;
  tenor_months: number;
  purpose: string | null;
  status: string;
  annual_interest_rate: number;
  monthly_installment: number;
  total_interest: number;
  total_repayment: number;
  terms_snapshot: any;
  schedule_snapshot: any;
  first_due_date: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

class MockReviewStore {
  private reviewTokens = new Set<string>();
  private withdrawals: MockWithdrawal[] = [];
  private loans: MockLoan[] = [];
  private nextWithdrawalId = 1001;
  private nextLoanId = 5001;

  isReviewEmail(email?: string): boolean {
    const configured = (process.env.NUSANET_SSO_REVIEW_EMAIL || "").trim().toLowerCase();
    if (!configured || !email) return false;
    return email.trim().toLowerCase() === configured;
  }

  isReviewToken(tokenStr: string): boolean {
    if (!tokenStr) return false;
    let part = tokenStr;
    if (tokenStr.includes("|")) {
      part = tokenStr.split("|")[1] || tokenStr;
    }
    return this.reviewTokens.has(part);
  }

  registerToken(tokenStr: string): void {
    let part = tokenStr;
    if (tokenStr.includes("|")) {
      part = tokenStr.split("|")[1] || tokenStr;
    }
    this.reviewTokens.add(part);
  }

  revokeToken(tokenStr: string): void {
    let part = tokenStr;
    if (tokenStr.includes("|")) {
      part = tokenStr.split("|")[1] || tokenStr;
    }
    this.reviewTokens.delete(part);
  }

  getEmployee() {
    const configuredEmail = (process.env.NUSANET_SSO_REVIEW_EMAIL || "reviewer@example.com").trim().toLowerCase();
    return {
      id: 999999,
      employer_id: 1,
      name: "Google Play Reviewer",
      email: configuredEmail,
      sso_subject_id: "demo-reviewer-subject-999",
      nik: "0000000000000000",
      nip: "REV-001",
      withdrawal_limit: 10000000,
      base_salary: 10000000,
      join_date: "2024-01-01",
      bank_name: "Bank Mandiri",
      bank_account_number: "1234567890",
      bank_account_holder: "Google Play Reviewer",
      status: "active",
      is_member: true,
      kyc_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      employer: {
        id: 1,
        company_name: "Nusanet",
        slug: "nusanet",
        cutoff_day: 25,
        fee_tiers: [
          { min: 0, max: 500000, fee: 15000 },
          { min: 500001, max: 1000000, fee: 25000 },
          { min: 1000001, max: null, fee: 35000 },
        ],
        max_withdrawal_amount: 5000000,
        status: "active",
      },
    };
  }

  getWithdrawals(): MockWithdrawal[] {
    return [...this.withdrawals];
  }

  getWithdrawalById(id: number): MockWithdrawal | undefined {
    return this.withdrawals.find((w) => w.id === id);
  }

  createWithdrawal(amount: number, fee: number = 15000): MockWithdrawal {
    const emp = this.getEmployee();
    const item: MockWithdrawal = {
      id: this.nextWithdrawalId++,
      employee_id: emp.id,
      employer_id: emp.employer_id,
      amount,
      fee,
      net_amount: amount - fee,
      daily_rate: 333333,
      days_worked: 15,
      pay_period_start: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
      pay_period_end: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      cutoff_day: 25,
      bank_name: emp.bank_name,
      bank_account_number: emp.bank_account_number,
      bank_account_holder: emp.bank_account_holder,
      status: "pending_transfer",
      requested_at: new Date().toISOString(),
      disbursed_at: null,
      rejection_reason: null,
    };
    this.withdrawals.unshift(item);
    return item;
  }

  getLoans(): MockLoan[] {
    return [...this.loans];
  }

  getLoanById(id: number): MockLoan | undefined {
    return this.loans.find((l) => l.id === id);
  }

  createLoan(data: Omit<MockLoan, "id">): MockLoan {
    const item: MockLoan = {
      id: this.nextLoanId++,
      ...data,
    };
    this.loans.unshift(item);
    return item;
  }

  reset(): void {
    this.reviewTokens.clear();
    this.withdrawals = [];
    this.loans = [];
  }
}

export const mockReviewStore = new MockReviewStore();

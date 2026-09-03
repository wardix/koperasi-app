import { InstallmentLine } from "./installment-line.js";

export class LoanQuote {
  constructor(
    public readonly principal: number,
    public readonly tenorMonths: number,
    public readonly annualInterestRate: string,
    public readonly monthlyInterestRate: string,
    public readonly monthlyInstallment: number,
    public readonly totalInterest: number,
    public readonly totalRepayment: number,
    public readonly schedule: InstallmentLine[]
  ) {}

  toArray() {
    return {
      principal: this.principal,
      tenor_months: this.tenorMonths,
      annual_interest_rate: this.annualInterestRate,
      monthly_interest_rate: this.monthlyInterestRate,
      monthly_installment: this.monthlyInstallment,
      total_interest: this.totalInterest,
      total_repayment: this.totalRepayment,
      schedule: this.schedule.map((line) => line.toArray()),
    };
  }

  toSummaryArray() {
    const summary: Record<string, unknown> = this.toArray();
    delete summary.schedule;
    return summary;
  }

  finalInstallment(): number {
    const last = this.schedule[this.schedule.length - 1];
    return last ? last.installment : this.monthlyInstallment;
  }
}

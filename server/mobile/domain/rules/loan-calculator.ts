import { LoanException } from "../exceptions.js";
import { InstallmentLine } from "../value-objects/installment-line.js";
import { LoanQuote } from "../value-objects/loan-quote.js";
import { LoanTerms } from "../value-objects/loan-terms.js";

export class LoanCalculator {
  quote(
    principal: number,
    tenorMonths: number,
    terms: LoanTerms,
    firstDueDate?: string | Date | null
  ): LoanQuote {
    if (principal < 1) {
      throw new LoanException("Principal must be greater than zero.", "invalid_principal", 422);
    }
    if (tenorMonths < 1) {
      throw new LoanException("Tenor must be at least 1 month.", "invalid_tenor", 422);
    }

    const monthlyRate = terms.monthlyRateFraction();
    const isInterestFree = terms.isInterestFree();
    const installment = this.calculateMonthlyInstallment(principal, tenorMonths, monthlyRate, isInterestFree);
    const schedule = this.buildSchedule(principal, tenorMonths, monthlyRate, installment, firstDueDate);

    const totalRepayment = schedule.reduce((sum, line) => sum + line.installment, 0);

    return new LoanQuote(
      principal,
      tenorMonths,
      terms.annualInterestRate,
      terms.monthlyInterestRate(),
      installment,
      totalRepayment - principal,
      totalRepayment,
      schedule
    );
  }

  private calculateMonthlyInstallment(
    principal: number,
    tenorMonths: number,
    monthlyRate: number,
    isInterestFree: boolean
  ): number {
    if (isInterestFree) {
      return Math.round(principal / tenorMonths);
    }

    const growth = Math.pow(1 + monthlyRate, tenorMonths);
    const numerator = principal * monthlyRate;
    const denominator = 1 - 1 / growth;

    return Math.round(numerator / denominator);
  }

  private buildSchedule(
    principal: number,
    tenorMonths: number,
    monthlyRate: number,
    installment: number,
    firstDueDate?: string | Date | null
  ): InstallmentLine[] {
    let balance = principal;
    const lines: InstallmentLine[] = [];

    const baseDueDate = firstDueDate ? new Date(firstDueDate) : null;

    for (let month = 1; month <= tenorMonths; month++) {
      const interest = Math.round(balance * monthlyRate);
      let principalPart = 0;
      let payment = 0;

      if (month === tenorMonths) {
        principalPart = balance;
        payment = balance + interest;
      } else {
        payment = installment;
        principalPart = Math.max(0, payment - interest);
      }

      balance -= principalPart;

      let dueDateStr: string | null = null;
      if (baseDueDate) {
        dueDateStr = this.addMonths(baseDueDate, month - 1);
      }

      lines.push(
        new InstallmentLine(
          month,
          payment,
          principalPart,
          interest,
          balance,
          dueDateStr
        )
      );
    }

    return lines;
  }

  private addMonths(date: Date, months: number): string {
    const d = new Date(date);
    const targetMonth = d.getUTCMonth() + months;
    d.setUTCMonth(targetMonth);
    return d.toISOString().slice(0, 10);
  }
}

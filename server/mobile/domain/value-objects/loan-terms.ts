import { LoanException } from "../exceptions.js";

export class LoanTerms {
  public static readonly RATE_DECIMALS = 5;

  constructor(public readonly annualInterestRate: string) {
    if (!/^\d+(\.\d+)?$/.test(annualInterestRate)) {
      throw new LoanException(`Invalid rate: ${annualInterestRate}`, "invalid_loan_rate", 500);
    }
    const dot = annualInterestRate.indexOf(".");
    const decimals = dot === -1 ? 0 : annualInterestRate.length - dot - 1;
    if (decimals > LoanTerms.RATE_DECIMALS) {
      throw new LoanException(`Rate is too precise: ${annualInterestRate}`, "rate_too_precise", 500);
    }
  }

  static fromArray(row: { annual_interest_rate?: string | number | null }): LoanTerms {
    let rate = row.annual_interest_rate;
    if (rate === null || rate === undefined || rate === "") {
      return new LoanTerms("0");
    }
    if (typeof rate === "number") {
      rate = rate.toFixed(LoanTerms.RATE_DECIMALS).replace(/\.?0+$/, "");
    }
    return new LoanTerms(String(rate).trim());
  }

  monthlyInterestRate(decimals: number = 8): string {
    const annual = parseFloat(this.annualInterestRate);
    const monthly = annual / 12;
    return monthly.toFixed(decimals);
  }

  monthlyRateFraction(): number {
    return parseFloat(this.annualInterestRate) / 100 / 12;
  }

  isInterestFree(): boolean {
    return parseFloat(this.annualInterestRate) === 0;
  }

  toArray() {
    return {
      annual_interest_rate: this.annualInterestRate,
    };
  }
}

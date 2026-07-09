import { expect, test, describe } from "bun:test";
import { calculateLoanInterest } from "./loanService";

describe("loanService", () => {
  test("calculateLoanInterest returns correct interest and total amount", () => {
    // 10,000,000 amount, 12 months tenor, 18% annual interest (1.5% monthly)
    const res = calculateLoanInterest(10000000, "12", 18);
    expect(res.interestAmount).toBe(1001600); // Annuity calculation
    expect(res.totalAmount).toBe(11001600);
  });

  test("calculateLoanInterest handles zero interest rate", () => {
    const res = calculateLoanInterest(5000000, "6", 0);
    expect(res.interestAmount).toBe(0);
    expect(res.totalAmount).toBe(5000000);
  });

  test("calculateLoanInterest handles fallback for invalid tenor", () => {
    const res = calculateLoanInterest(2000000, "invalid-tenor", 24.0);
    // Should fallback to 1 month tenor: 24% annual = 2% monthly: 2,040,000 total
    expect(res.interestAmount).toBe(40000);
    expect(res.totalAmount).toBe(2040000);
  });
});

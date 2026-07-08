import { expect, test, describe } from "bun:test";
import { calculateLoanInterest } from "./loanService";

describe("loanService", () => {
  test("calculateLoanInterest returns correct interest and total amount", () => {
    // 10,000,000 amount, 12 months tenor, 1.5% monthly interest
    const res = calculateLoanInterest(10000000, "12", 1.5);
    expect(res.interestAmount).toBe(1800000); // 10M * 0.015 * 12 = 1.8M
    expect(res.totalAmount).toBe(11800000);
  });

  test("calculateLoanInterest handles zero interest rate", () => {
    const res = calculateLoanInterest(5000000, "6", 0);
    expect(res.interestAmount).toBe(0);
    expect(res.totalAmount).toBe(5000000);
  });

  test("calculateLoanInterest handles fallback for invalid tenor", () => {
    const res = calculateLoanInterest(2000000, "invalid-tenor", 2.0);
    // Should fallback to 1 month tenor: 2M * 0.02 * 1 = 40,000
    expect(res.interestAmount).toBe(40000);
    expect(res.totalAmount).toBe(2040000);
  });
});

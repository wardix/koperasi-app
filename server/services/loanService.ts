export function calculateLoanInterest(amount: number, tenor: string | number, bungaRate: number) {
  const tenorMonths = Math.max(1, parseInt(String(tenor)) || 1);
  
  if (bungaRate <= 0) {
    return {
      interestAmount: 0,
      totalAmount: amount
    };
  }

  // bungaRate is the annual interest rate (e.g., 18 for 18% per year)
  // Monthly interest rate i = (bungaRate / 12) / 100
  const i = bungaRate / 1200;

  // Annuity formula for monthly payment A
  // A = P * (i * (1 + i)^n) / ((1 + i)^n - 1)
  const power = Math.pow(1 + i, tenorMonths);
  const monthlyPayment = amount * (i * power) / (power - 1);
  
  const roundedMonthlyPayment = Math.ceil(monthlyPayment);
  const totalAmount = roundedMonthlyPayment * tenorMonths;
  const interestAmount = totalAmount - amount;

  return {
    interestAmount,
    totalAmount
  };
}

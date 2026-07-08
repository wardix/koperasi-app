export function calculateLoanInterest(amount: number, tenor: string, bungaRate: number) {
  const tenorMonths = parseInt(tenor) || 1;
  const interestAmount = Math.round(amount * (bungaRate / 100) * tenorMonths);
  const totalAmount = amount + interestAmount;
  
  return {
    interestAmount,
    totalAmount
  };
}

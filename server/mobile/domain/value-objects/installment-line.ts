export class InstallmentLine {
  constructor(
    public readonly number: number,
    public readonly installment: number,
    public readonly principal: number,
    public readonly interest: number,
    public readonly remainingBalance: number,
    public readonly dueDate: string | null = null
  ) {}

  toArray() {
    return {
      number: this.number,
      due_date: this.dueDate,
      installment: this.installment,
      principal: this.principal,
      interest: this.interest,
      remaining_balance: this.remainingBalance,
    };
  }
}

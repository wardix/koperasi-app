export class PayPeriod {
  public readonly accrualStart: string;

  constructor(
    public readonly start: string, // YYYY-MM-DD
    public readonly end: string,   // YYYY-MM-DD
    public readonly totalDays: number,
    public readonly daysElapsed: number,
    accrualStart?: string
  ) {
    this.accrualStart = accrualStart ?? start;
  }

  payday(): string {
    const d = new Date(this.end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  progressPercent(): number {
    if (this.totalDays <= 0) return 0.0;
    return Math.min(100.0, (this.daysElapsed / this.totalDays) * 100);
  }

  daysRemaining(): number {
    return Math.max(0, this.totalDays - this.daysElapsed);
  }

  contains(dateStr: string): boolean {
    return dateStr >= this.start && dateStr <= this.end;
  }

  isProrated(): boolean {
    return this.accrualStart > this.start;
  }

  toArray() {
    return {
      start: this.start,
      end: this.end,
      accrual_start: this.accrualStart,
      total_days: this.totalDays,
      days_elapsed: this.daysElapsed,
    };
  }
}

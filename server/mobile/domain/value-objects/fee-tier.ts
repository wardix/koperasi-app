export class FeeTier {
  constructor(
    public readonly minAmount: number,
    public readonly maxAmount: number | null,
    public readonly fee: number
  ) {}

  covers(amount: number): boolean {
    return amount >= this.minAmount && (this.maxAmount === null || amount <= this.maxAmount);
  }

  isOpenEnded(): boolean {
    return this.maxAmount === null;
  }

  static fromArray(row: { min_amount?: number | string | null; max_amount?: number | string | null; fee?: number | string | null }): FeeTier {
    return new FeeTier(
      this.toInt(row.min_amount ?? 0) ?? 0,
      this.toInt(row.max_amount ?? null),
      this.toInt(row.fee ?? 0) ?? 0
    );
  }

  toArray() {
    return {
      min_amount: this.minAmount,
      max_amount: this.maxAmount,
      fee: this.fee,
    };
  }

  private static toInt(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "number") {
      return Math.round(value);
    }
    const digits = value.replace(/\D/g, "");
    return digits === "" ? null : parseInt(digits, 10);
  }
}

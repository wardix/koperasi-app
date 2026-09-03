import { FeeScheduleException } from "../exceptions.js";
import { FeeTier } from "./fee-tier.js";

export class FeeSchedule {
  public readonly tiers: FeeTier[];

  constructor(tiers: FeeTier[]) {
    if (tiers.length === 0) {
      throw FeeScheduleException.empty();
    }

    const lastIndex = tiers.length - 1;

    for (let index = 0; index < tiers.length; index++) {
      const tier = tiers[index];
      if (tier.fee < 0) {
        throw FeeScheduleException.negativeFee(tier.fee);
      }

      if (tier.isOpenEnded() && index !== lastIndex) {
        throw FeeScheduleException.unboundedBandNotLast(index + 1);
      }

      if (tier.maxAmount !== null && tier.maxAmount < tier.minAmount) {
        throw FeeScheduleException.bandNotAscending(tier.minAmount, tier.maxAmount);
      }
    }

    this.tiers = tiers;
  }

  static fromArray(rows: Array<{ max_amount?: number | string | null; fee?: number | string | null }>): FeeSchedule {
    const tiers: FeeTier[] = [];
    let nextMin = 0;

    for (const row of rows) {
      const maxVal = row.max_amount !== undefined ? row.max_amount : (row as any).max;
      const tier = FeeTier.fromArray({
        min_amount: nextMin,
        max_amount: maxVal ?? null,
        fee: row.fee ?? 0,
      });

      tiers.push(tier);
      nextMin = tier.maxAmount === null ? 0 : tier.maxAmount + 1;
    }

    return new FeeSchedule(tiers);
  }

  feeFor(amount: number): number {
    if (amount <= 0) {
      return 0;
    }
    return this.tierFor(amount).fee;
  }

  tierFor(amount: number): FeeTier {
    for (const tier of this.tiers) {
      if (tier.covers(amount)) {
        return tier;
      }
    }
    throw FeeScheduleException.noTierFor(amount);
  }

  maxCoveredAmount(): number | null {
    return this.tiers[this.tiers.length - 1].maxAmount;
  }

  covers(amount: number): boolean {
    const ceiling = this.maxCoveredAmount();
    return ceiling === null || amount <= ceiling;
  }

  toArray() {
    return this.tiers.map((tier) => tier.toArray());
  }
}

import { FeeSchedule } from "./fee-schedule.js";
import { PayPeriod } from "./pay-period.js";

export class WalletBalance {
  constructor(
    public readonly period: PayPeriod,
    public readonly withdrawalLimit: number,
    public readonly maxWithdrawalAmount: number | null,
    public readonly effectiveLimit: number,
    public readonly dailyRate: number,
    public readonly unlocked: number,
    public readonly alreadyWithdrawn: number,
    public readonly maxWithdrawable: number,
    public readonly feeSchedule: FeeSchedule
  ) {}

  isCappedByEmployer(): boolean {
    return (
      this.maxWithdrawalAmount !== null &&
      this.withdrawalLimit > this.maxWithdrawalAmount
    );
  }

  toArray() {
    return {
      withdrawal_limit: this.withdrawalLimit,
      max_withdrawal_amount: this.maxWithdrawalAmount,
      effective_limit: this.effectiveLimit,
      capped_by_employer: this.isCappedByEmployer(),
      daily_rate: this.dailyRate,
      unlocked: this.unlocked,
      already_withdrawn: this.alreadyWithdrawn,
      max_withdrawable: this.maxWithdrawable,
      fee_tiers: this.feeSchedule.toArray(),
      period_start: this.period.start,
      period_end: this.period.end,
      payday: this.period.payday(),
      total_days: this.period.totalDays,
      days_elapsed: this.period.daysElapsed,
      days_remaining: this.period.daysRemaining(),
    };
  }
}
